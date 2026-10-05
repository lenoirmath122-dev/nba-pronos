"use server";

import { getServerClient } from "@/lib/supabase/server";
import { getProfileBadges, type BadgeDisplay } from "@/lib/queries/badges";

// Popup « nouveau badge » (p3-9, retour de l'alpha) : appelée par
// NewBadgesWatcher APRÈS le premier affichage plutôt que lue par la coquille
// (app/(app)/layout.tsx) — getProfileBadges agrège des vues à vie, inutile de
// retarder chaque chargement de page pour ça. Lecture seule, sur le joueur de
// la session uniquement.

export type UnlockedBadges = { userId: string; badges: BadgeDisplay[] };

export async function getUnlockedBadges(): Promise<UnlockedBadges | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { categories } = await getProfileBadges(user.id);
  const badges = categories
    .flatMap((category) => category.badges)
    .filter((badge) => (badge.kind === "tiered" ? badge.tier !== null : badge.unlocked));
  return { userId: user.id, badges };
}
