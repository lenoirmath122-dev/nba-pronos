"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { checkAnonRateLimit } from "@/lib/auth/anonRateLimit";
import { normalizePseudo, pseudoLengthError } from "@/lib/pseudo/rules";
import type { BasketItem } from "@/lib/publicHome/basket";
import { buildPredictionRows, registrationError, type MatchForBasket } from "@/lib/publicHome/register";

// Parcours « jouer d'abord, s'inscrire ensuite » (plan d'attractivité, §1.6) :
// compte en attente + pronos en base, lien de validation, pseudo après Google,
// préférences d'e-mail. Un compte PENDING n'a jamais de session tant que le
// lien n'a pas été cliqué (/auth/callback l'active).

export type GuestResult = { ok: true } | { ok: false; error: string };

const RATE_LIMIT_ERROR = "Trop de tentatives. Réessaie dans quelques minutes.";
const SEND_ERROR = "Impossible d'envoyer l'e-mail pour le moment. Réessaie dans un instant.";
const SENT_OK: GuestResult = { ok: true };

async function siteOrigin(): Promise<string> {
  const headerList = await headers();
  return `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
}

/** Lien magique de connexion pour un compte qui existe déjà (jamais de création ici). */
async function sendLoginLink(email: string): Promise<boolean> {
  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  return !error;
}

async function insertPredictions(userId: string, items: BasketItem[]): Promise<void> {
  const service = getServiceClient();
  const ids = [...new Set(items.map((i) => i.matchId))].slice(0, 20);
  if (ids.length === 0) return;
  const { data: matches } = await service
    .from("matches")
    .select("id, competition_id, scheduled_at, status, home_team_id, away_team_id")
    .in("id", ids)
    .returns<MatchForBasket[]>();
  const rows = buildPredictionRows(userId, items, matches ?? [], Date.now());
  if (rows.length === 0) return;
  // Jamais d'écrasement : un prono déjà en base (donc déjà validé) reste intact.
  await service.from("match_predictions").upsert(rows, { onConflict: "user_id,match_id", ignoreDuplicates: true });
}

/** Écran ② : crée le compte en attente, enregistre le panier, envoie le lien. */
export async function registerPronos(input: {
  pseudo: string;
  email: string;
  ageConfirmed: boolean;
  items: BasketItem[];
}): Promise<GuestResult> {
  const pseudo = normalizePseudo(input.pseudo);
  const email = input.email.trim().toLowerCase();
  const invalid = registrationError({ pseudo, email, ageConfirmed: input.ageConfirmed });
  if (invalid) return { ok: false, error: invalid };
  if (!(await checkAnonRateLimit("guest_register", 10, 3600))) return { ok: false, error: RATE_LIMIT_ERROR };

  const service = getServiceClient();
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { pseudo, pending_validation: "true" },
  });

  if (error || !created.user) {
    // E-mail déjà inscrit : même écran que pour un nouveau compte (pas de fuite
    // sur qui est inscrit), avec un lien de connexion. Le panier reste dans le
    // navigateur et sera enregistré à la connexion (/bienvenue).
    if (error?.code === "email_exists") {
      return (await sendLoginLink(email)) ? SENT_OK : { ok: false, error: SEND_ERROR };
    }
    const { data: taken } = await service.from("users").select("id").eq("pseudo", pseudo).maybeSingle();
    if (taken) return { ok: false, error: "Ce pseudo est déjà pris." };
    console.error("registerPronos : createUser en échec —", error?.message);
    return { ok: false, error: "Impossible de créer le compte. Réessaie." };
  }

  await insertPredictions(created.user.id, input.items);
  return (await sendLoginLink(email)) ? SENT_OK : { ok: false, error: SEND_ERROR };
}

/** « Renvoyer le mail » et « Recevoir un lien de connexion » : même réponse que l'adresse existe ou non. */
export async function requestLoginLink(emailRaw: string): Promise<GuestResult> {
  const email = emailRaw.trim().toLowerCase();
  const invalid = registrationError({ pseudo: "xxx", email, ageConfirmed: true });
  if (invalid) return { ok: false, error: invalid };
  if (!(await checkAnonRateLimit("login_link", 5, 3600))) return { ok: false, error: RATE_LIMIT_ERROR };
  return (await sendLoginLink(email)) ? SENT_OK : { ok: false, error: SEND_ERROR };
}

/** Connecté : enregistre les pronos du panier qui ne sont pas déjà en base. */
export async function saveBasketForCurrentUser(items: BasketItem[]): Promise<{ saved: boolean }> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { saved: false };
  await insertPredictions(user.id, items);
  revalidatePath("/play");
  revalidatePath("/home");
  return { saved: true };
}

/** Après Google : choix du pseudo + case 15 ans, puis le compte devient ACTIVE. */
export async function completeProfile(input: { pseudo: string; ageConfirmed: boolean }): Promise<GuestResult> {
  const pseudo = normalizePseudo(input.pseudo);
  const lengthError = pseudoLengthError(pseudo);
  if (lengthError) return { ok: false, error: lengthError };
  if (!input.ageConfirmed) {
    return { ok: false, error: "Panier Ballon est réservé aux 15 ans et plus. Coche la case pour confirmer ton âge." };
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée. Reconnecte-toi." };

  const service = getServiceClient();
  const { data: taken } = await service.from("users").select("id").eq("pseudo", pseudo).neq("id", user.id).maybeSingle();
  if (taken) return { ok: false, error: "Ce pseudo est déjà pris." };

  // Réservé aux comptes en attente sans déclaration d'âge (arrivée par Google).
  const { data: updated, error } = await service
    .from("users")
    .update({ pseudo, age_confirmed_at: new Date().toISOString(), status: "ACTIVE" })
    .eq("id", user.id)
    .eq("status", "PENDING")
    .is("age_confirmed_at", null)
    .select("id");
  if (error || !updated?.length) return { ok: false, error: "Impossible d'enregistrer ton pseudo. Réessaie." };
  return SENT_OK;
}

/** Page Bienvenue : préférences d'e-mail (le push reste géré à part). */
export async function updateEmailPreferences(input: { results: boolean; reminders: boolean }): Promise<GuestResult> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { error } = await supabase
    .from("users")
    .update({ email_results_enabled: input.results, email_reminders_enabled: input.reminders })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Impossible d'enregistrer tes préférences." };
  return SENT_OK;
}
