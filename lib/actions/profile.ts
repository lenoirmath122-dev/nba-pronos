"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

// Server actions de l'écran Profil (SPEC_ECRAN_PROFIL_V0_1 §7). Écriture
// directe sur `users` (RLS self-update + trigger anti-escalade déjà en
// place, migration #3 — aucune migration nécessaire pour ce lot, §12).
// Formulaires natifs SANS JS (§1) : chaque action reçoit un FormData brut et
// REDIRIGE, même patron que requestPredictionCorrectionFormAction
// (lib/actions/corrections.ts) — une erreur est portée par l'URL de
// redirection, jamais par un état client (pas de useActionState ici).

/** Toggle thème (§4) : soumission immédiate, un seul champ. */
export async function updateThemePreference(formData: FormData): Promise<void> {
  const theme = String(formData.get("theme") ?? "");
  if (theme !== "LIGHT" && theme !== "DARK") {
    redirect("/profile?profileError=Th%C3%A8me%20invalide.");
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ theme_preference: theme })
    .eq("id", user!.id);

  if (error) {
    redirect(`/profile?profileError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout"); // app/layout.tsx (racine) relit theme_preference
  redirect("/profile");
}

/** Couleurs d'équipe sur Profil (BACKLOG_V1.md « Personnalisation du
 *  profil ») : bascule persistée, même patron que updateThemePreference —
 *  un seul champ, soumission immédiate. Sans effet réel tant qu'aucune
 *  équipe favorite n'est choisie (la page ne montre ce bouton que dans ce
 *  cas), mais rien n'empêche la valeur d'exister en base avant. */
export async function updateTeamColorsPreference(formData: FormData): Promise<void> {
  const useTeamColors = String(formData.get("useTeamColors") ?? "") === "true";

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ use_team_colors: useTeamColors })
    .eq("id", user!.id);

  if (error) {
    redirect(`/profile?profileError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  redirect("/profile");
}

/** Équipe favorite + bio (§3) : un seul formulaire, bouton « Enregistrer ». */
export async function updateProfile(formData: FormData): Promise<void> {
  const favoriteTeamIdRaw = String(formData.get("favoriteTeamId") ?? "");
  const favoriteTeamId = favoriteTeamIdRaw === "" ? null : favoriteTeamIdRaw;
  const bioRaw = String(formData.get("bio") ?? "").trim();
  const bio = bioRaw === "" ? null : bioRaw;

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ favorite_team_id: favoriteTeamId, bio })
    .eq("id", user!.id);

  if (error) {
    redirect(`/profile?profileError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  redirect("/profile");
}
