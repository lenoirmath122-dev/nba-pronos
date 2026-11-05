"use server";

import { getProfileData } from "@/lib/queries/profile";
import { getProfileStats } from "@/lib/queries/stats";
import { getProfileBadges } from "@/lib/queries/badges";

// Données du panneau Profil de la TabBar (en-tête + carte résumé Stats),
// lues À L'OUVERTURE du panneau plutôt que dans le layout : elles ne
// ralentissent donc pas chaque page. Chaque champ vaut null quand la donnée
// n'existe pas (pas de compétition active, pas encore de match scoré...).
export type ProfileMenuSummary = {
  pseudo: string;
  rank: number | null;
  points: number | null;
  accuracyPct: number | null;
  bestRank: number | null;
  badgeCount: number | null;
  badgeTotal: number | null;
};

export async function getProfileMenuSummary(): Promise<ProfileMenuSummary | null> {
  const profile = await getProfileData();
  if (!profile) return null;

  const [stats, badges] = await Promise.all([
    getProfileStats().catch(() => null),
    getProfileBadges().catch(() => null),
  ]);

  const active = stats?.hasActiveCompetition ? stats : null;
  const ranks = active?.evolution.series.map((p) => p.rank) ?? [];
  const allBadges = badges ? badges.categories.flatMap((c) => c.badges) : null;
  const badgeCount = allBadges ? allBadges.filter((b) => (b.kind === "tiered" ? b.tier !== null : b.unlocked)).length : null;

  return {
    pseudo: profile.pseudo,
    rank: active?.rank.value ?? null,
    points: active?.pointsBreakdown.totalPoints ?? null,
    accuracyPct: active?.accuracy.winnerAccuracyPct ?? null,
    bestRank: ranks.length > 0 ? Math.min(...ranks) : null,
    badgeCount,
    badgeTotal: allBadges ? allBadges.length : null,
  };
}
