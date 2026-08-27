"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getProfileBadges } from "@/lib/queries/badges";

// Server actions de l'écran Profil (SPEC_ECRAN_PROFIL_V0_1 §7). Écriture
// directe sur `users` (RLS self-update + trigger anti-escalade déjà en
// place, migration #3 — aucune migration nécessaire pour ce lot, §12).
// Formulaires natifs SANS JS (§1) : chaque action reçoit un FormData brut et
// REDIRIGE, même patron que requestPredictionCorrectionFormAction
// (lib/actions/corrections.ts) — une erreur est portée par l'URL de
// redirection, jamais par un état client (pas de useActionState ici).

/** Thème Sombre/Clair/Photo (§4, 3e valeur PHOTO le 06/08/2026) : soumission
 *  immédiate, un seul champ. */
export async function updateThemePreference(formData: FormData): Promise<void> {
  const theme = String(formData.get("theme") ?? "");
  if (theme !== "LIGHT" && theme !== "DARK" && theme !== "PHOTO") {
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

/** Fond d'écran (§.photo-page) : soumission immédiate, un seul champ, même
 *  patron que updateThemePreference ci-dessus. */
export async function updateBackgroundTheme(formData: FormData): Promise<void> {
  const backgroundTheme = String(formData.get("backgroundTheme") ?? "");
  if (backgroundTheme !== "MURAL" && backgroundTheme !== "HOOP" && backgroundTheme !== "HK") {
    redirect("/profile?profileError=Fond%20d%27%C3%A9cran%20invalide.");
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ background_theme: backgroundTheme })
    .eq("id", user!.id);

  if (error) {
    redirect(`/profile?profileError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout"); // app/layout.tsx (racine) relit background_theme
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

const MAX_PINNED_BADGES = 3;

/** Badges épinglés dans le bandeau (BACKLOG_V1.md, cadré le 27/08/2026) :
 *  choix manuel du joueur, jusqu'à 3, uniquement parmi les débloqués --
 *  bouton "épingler" sur chaque BadgeCard (components/profile/BadgeCard.tsx),
 *  même patron formulaire natif + redirection que le reste de ce fichier. */
export async function togglePinnedBadgeFormAction(formData: FormData): Promise<void> {
  const badgeId = String(formData.get("badgeId") ?? "");
  if (!badgeId) redirect("/profile?tab=stats");

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("users")
    .select("pinned_badge_ids")
    .eq("id", user!.id)
    .single<{ pinned_badge_ids: string[] }>();
  const current = row?.pinned_badge_ids ?? [];

  let next: string[];
  if (current.includes(badgeId)) {
    next = current.filter((id) => id !== badgeId);
  } else {
    if (current.length >= MAX_PINNED_BADGES) {
      redirect(`/profile?tab=stats&profileError=${encodeURIComponent(`${MAX_PINNED_BADGES} badges épinglés maximum.`)}`);
    }
    // Défense en profondeur -- BadgeCard ne propose déjà le bouton "épingler"
    // que sur un badge débloqué, cf. commentaire ci-dessus.
    const badges = await getProfileBadges();
    const target = badges.categories.flatMap((c) => c.badges).find((b) => b.id === badgeId);
    const unlocked = target ? (target.kind === "tiered" ? target.tier !== null : target.unlocked) : false;
    if (!unlocked) {
      redirect(`/profile?tab=stats&profileError=${encodeURIComponent("Ce badge n'est pas encore débloqué.")}`);
    }
    next = [...current, badgeId];
  }

  const { error } = await supabase.from("users").update({ pinned_badge_ids: next }).eq("id", user!.id);
  if (error) {
    redirect(`/profile?tab=stats&profileError=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/profile");
  redirect("/profile?tab=stats");
}
