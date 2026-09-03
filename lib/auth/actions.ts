"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export type AuthFormState = { error: string } | undefined;

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (error) {
    // Vérification CAPTCHA (audit de sécurité, finding 3, Turnstile) : message
    // dédié plutôt que le générique "Email ou mot de passe incorrect", qui
    // induirait en erreur sur la vraie cause (widget bloqué par un
    // bloqueur de pub, script Cloudflare indisponible...).
    if (error.message.toLowerCase().includes("captcha")) {
      return { error: "Vérification de sécurité échouée. Réessaie (désactive un éventuel bloqueur de pub)." };
    }
    return { error: "Email ou mot de passe incorrect." };
  }

  redirect("/home");
}

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const pseudo = String(formData.get("pseudo") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const ageConfirmed = formData.get("ageConfirmed") === "on";
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "");

  if (!pseudo || !email || !password) {
    return { error: "Tous les champs sont obligatoires." };
  }
  if (password.length < 8) {
    return { error: "Le mot de passe doit faire au moins 8 caractères." };
  }
  // Déclaration d'âge (cadrage juridique §2.10 point 4, 03/09/2026) : case
  // bloquante — aucun mécanisme de consentement parental n'existe pour les
  // moins de 15 ans, donc pas de compte créé sans cette confirmation
  // (handle_new_user horodate systématiquement age_confirmed_at ensuite,
  // migration 20260903120000).
  if (!ageConfirmed) {
    return { error: "Panier Ballon est réservé aux 15 ans et plus. Coche la case pour confirmer ton âge." };
  }

  const supabase = await getServerClient();
  const headerList = await headers();
  const origin = `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;

  // Temps 1a — code compétition, vérifié serveur (T2 §4/§5). Champ optionnel :
  // laissé vide, on rattache simplement à la compétition ACTIVE courante (une
  // seule possible à la fois, contrainte uniq_one_active_competition).
  if (code) {
    const { data: competitionId, error: codeError } = await supabase.rpc(
      "verify_join_code",
      { p_code: code }
    );
    if (codeError || !competitionId) {
      return { error: "Code compétition invalide." };
    }
  } else {
    const { data: activeCompetition, error: activeError } = await supabase
      .from("competitions")
      .select("id")
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (activeError || !activeCompetition) {
      return { error: "Aucune compétition active pour le moment." };
    }
  }

  // Temps 1b — pseudo libre (T2 §4).
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("pseudo", pseudo)
    .maybeSingle();
  if (existing) {
    return { error: "Ce pseudo est déjà pris." };
  }

  // Temps 2 — création de l'auth.users ; le trigger handle_new_user (École A,
  // T2 §3) matérialise public.users dans la même transaction.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { pseudo }, emailRedirectTo: `${origin}/email-confirmed`, captchaToken },
  });

  // Énumération de compte assumée ici (audit de sécurité, finding 14,
  // security-audit-report.md §1 -- décidé AVEC l'utilisateur le 02/09/2026,
  // GAPS_OUVERTS.md) : ce message confirme explicitement sur l'écran qu'un
  // email donné a déjà un compte, contrairement au flux reset-password qui
  // reste générique. Compromis conscient plutôt qu'un oubli -- gain UX jugé
  // supérieur au risque tant que l'app reste un cercle fermé d'amis (pas de
  // rate-limiting/CAPTCHA sur le login non plus, finding 3, donc
  // l'énumération seule n'ouvre aucun accès). À généraliser (même patron que
  // ResetPasswordForm.tsx, toujours rediriger vers /verify-email avec un
  // message conditionnel) si l'app s'ouvre un jour à un public plus large.
  if (signUpError) {
    if (signUpError.message.toLowerCase().includes("already registered")) {
      return { error: "Un compte existe déjà avec cet email." };
    }
    // Vérification CAPTCHA (audit de sécurité, finding 3, Turnstile) : même
    // message dédié que login(), plutôt que le générique ci-dessous.
    if (signUpError.message.toLowerCase().includes("captcha")) {
      return { error: "Vérification de sécurité échouée. Réessaie (désactive un éventuel bloqueur de pub)." };
    }
    return { error: "Impossible de créer le compte. Réessaie." };
  }

  // Anti-énumération Supabase (bug réel trouvé le 16/08/2026) : pour un email
  // déjà enregistré ET confirmé, signUp() ne renvoie AUCUNE erreur — data.user
  // existe mais sans identité rattachée (identities: []) et sans session.
  if (signUpData.user?.identities?.length === 0) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  // Temps 3a — Confirm email actif en prod (bug trouvé le 18/08/2026) :
  // `!session` seul ne veut PAS dire "compte existant" — un compte tout
  // neuf en attente de confirmation n'a pas non plus de session tant que le
  // lien n'est pas cliqué. Distinct du cas ci-dessus (identities non vide ==
  // vraie nouvelle identité créée), sinon un signup légitime se faisait
  // rejeter avec le même message que "compte déjà pris".
  if (!signUpData.session) {
    redirect("/verify-email");
  }

  // Temps 3b — compte ACTIVE immédiat + session ouverte (C4, quand Confirm
  // email est désactivé).
  redirect("/home");
}

export async function logout() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
