import type { BadgeDisplay } from "@/lib/queries/badges";
import { TIER_LABELS, TIER_ORDER, isBadgeUnlocked, tierRank } from "./display";
import { TIERED_BADGE_THRESHOLDS } from "./thresholds";

// Résumé de l'onglet Badges (chantier Profil & badges, Lot 4) : compteur
// « 17/35 » et badges « les plus proches » d'un palier. SANS dépendance
// serveur (import de type seulement), comme lib/badges/display.ts.

export function countUnlocked(badges: BadgeDisplay[]): number {
  return badges.filter(isBadgeUnlocked).length;
}

export type ClosestBadge = { badge: BadgeDisplay; remaining: number; target: string };

/** Les `max` badges les plus proches de leur prochain palier (ou de leur
 *  déblocage pour une marche de l'échelle), en pourcentage du seuil visé. Un
 *  compteur à 0, un badge binaire et un badge au palier maximum sont exclus :
 *  rien à « presque » atteindre. À pourcentage égal, le moins d'unités restantes
 *  d'abord. */
export function closestBadges(badges: BadgeDisplay[], max: number): ClosestBadge[] {
  const candidates: (ClosestBadge & { ratio: number })[] = [];
  for (const badge of badges) {
    if (badge.kind === "tiered") {
      if (badge.nextThreshold === null || badge.value <= 0) continue;
      const nextTier = TIER_ORDER[tierRank(badge)];
      candidates.push({
        badge,
        remaining: badge.nextThreshold - badge.value,
        target: TIER_LABELS[nextTier],
        ratio: badge.value / badge.nextThreshold,
      });
    } else if (badge.kind === "ladderStep") {
      if (badge.unlocked || badge.value <= 0) continue;
      candidates.push({ badge, remaining: badge.threshold - badge.value, target: "le badge", ratio: badge.value / badge.threshold });
    }
  }
  candidates.sort((a, b) => b.ratio - a.ratio || a.remaining - b.remaining);
  return candidates.slice(0, Math.max(max, 0)).map(({ badge, remaining, target }) => ({ badge, remaining, target }));
}

/** Les 5 seuils d'un badge à paliers, [] pour les autres. */
export function tierThresholds(badge: BadgeDisplay): readonly number[] {
  return badge.kind === "tiered" ? TIERED_BADGE_THRESHOLDS[badge.id] : [];
}
