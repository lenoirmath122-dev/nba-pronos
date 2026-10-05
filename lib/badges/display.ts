import type { BadgeDisplay } from "@/lib/queries/badges";
import type { BadgeId, BadgeTier } from "./thresholds";

// Petits utilitaires d'affichage des badges partagés par la carte du profil,
// l'écusson et la popup « nouveau badge » (p3-9) — SANS dépendance serveur
// (import de type seulement depuis lib/queries/badges.ts), consommés par des
// composants client.

export const TIER_ORDER: readonly BadgeTier[] = ["BRONZE", "ARGENT", "OR", "PLATINE", "DIAMANT"];

export const TIER_LABELS: Record<BadgeTier, string> = {
  BRONZE: "Bronze",
  ARGENT: "Argent",
  OR: "Or",
  PLATINE: "Platine",
  DIAMANT: "Diamant",
};

export function isBadgeUnlocked(badge: BadgeDisplay): boolean {
  return badge.kind === "tiered" ? badge.tier !== null : badge.unlocked;
}

/** Rang du palier, 1 (Bronze) à 5 (Diamant) ; 0 hors badge à paliers ou sous Bronze. */
export function tierRank(badge: BadgeDisplay): number {
  return badge.kind === "tiered" && badge.tier ? TIER_ORDER.indexOf(badge.tier) + 1 : 0;
}

/** Ce que l'appareil retient d'un badge débloqué pour savoir s'il a déjà été
 *  montré : son palier pour un badge à paliers, "1" sinon. */
export function badgeSeenKey(badge: BadgeDisplay): string {
  return badge.kind === "tiered" ? (badge.tier ?? "") : "1";
}

export type SeenBadges = Partial<Record<BadgeId, string>>;

/** Badges débloqués (ou passés à un palier supérieur) que l'appareil n'a pas
 *  encore montrés, dans l'ordre reçu. Un appareil qui n'a jamais rien vu
 *  montre tout (choix de l'utilisateur, 05/10/2026). */
export function unseenBadges(badges: BadgeDisplay[], seen: SeenBadges): BadgeDisplay[] {
  return badges.filter((badge) => isBadgeUnlocked(badge) && seen[badge.id] !== badgeSeenKey(badge));
}

export function seenSnapshot(badges: BadgeDisplay[]): SeenBadges {
  const snapshot: SeenBadges = {};
  for (const badge of badges) {
    if (isBadgeUnlocked(badge)) snapshot[badge.id] = badgeSeenKey(badge);
  }
  return snapshot;
}
