import type { BadgeDisplay } from "@/lib/queries/badges";
import { isBadgeUnlocked, tierRank } from "./display";

// Vitrine d'un joueur (chantier Profil & badges, D1) : les badges mis en avant
// à côté de son pseudo. SANS dépendance serveur (import de type seulement),
// comme lib/badges/display.ts.

/** Poids d'un badge débloqué pour le choix auto : le palier d'un badge à
 *  paliers (1 à 5), le niveau d'une marche de l'échelle de risque (1 à 5), 1
 *  pour un badge binaire (pas de palier). */
function showcaseRank(badge: BadgeDisplay): number {
  if (badge.kind === "ladderStep") return badge.level;
  return badge.kind === "tiered" ? tierRank(badge) : 1;
}

/** Les `max` badges de la vitrine. `badges` est dans l'ordre du catalogue.
 *  Les épinglés (débloqués) passent d'abord, dans l'ordre choisi ; le reste
 *  est complété par les badges de plus haut palier, à palier égal le plus
 *  tardif du catalogue. Un id épinglé inconnu ou plus débloqué est ignoré. */
export function resolveShowcase(badges: BadgeDisplay[], pinnedIds: string[], max: number): BadgeDisplay[] {
  if (max <= 0) return [];
  const byId = new Map(badges.map((badge) => [badge.id as string, badge]));

  const showcase: BadgeDisplay[] = [];
  for (const id of pinnedIds) {
    const badge = byId.get(id);
    if (badge && isBadgeUnlocked(badge) && !showcase.includes(badge)) showcase.push(badge);
    if (showcase.length >= max) return showcase;
  }

  const auto = badges
    .map((badge, index) => ({ badge, index }))
    .filter(({ badge }) => isBadgeUnlocked(badge) && !showcase.includes(badge))
    .sort((a, b) => showcaseRank(b.badge) - showcaseRank(a.badge) || b.index - a.index);

  for (const { badge } of auto) {
    if (showcase.length >= max) break;
    showcase.push(badge);
  }
  return showcase;
}
