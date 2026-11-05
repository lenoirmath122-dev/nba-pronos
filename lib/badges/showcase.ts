import type { BadgeDisplay } from "@/lib/queries/badges";
import { isBadgeUnlocked } from "./display";

// Vitrine d'un joueur (chantier Profil & badges) : les badges qu'il a épinglés,
// à côté de son pseudo. Aucun complément automatique (décision du 24/10/2026,
// D1 abandonnée) : sans épingle, pas d'écusson. SANS dépendance serveur
// (import de type seulement), comme lib/badges/display.ts.

/** Les `max` badges de la vitrine. `badges` est dans l'ordre du catalogue.
 *  Seuls les badges épinglés (et débloqués) sont montrés, dans l'ordre choisi.
 *  Un id épinglé inconnu, plus débloqué ou en double est ignoré. */
export function resolveShowcase(badges: BadgeDisplay[], pinnedIds: string[], max: number): BadgeDisplay[] {
  if (max <= 0) return [];
  const byId = new Map(badges.map((badge) => [badge.id as string, badge]));

  const showcase: BadgeDisplay[] = [];
  for (const id of pinnedIds) {
    const badge = byId.get(id);
    if (badge && isBadgeUnlocked(badge) && !showcase.includes(badge)) showcase.push(badge);
    if (showcase.length >= max) break;
  }
  return showcase;
}
