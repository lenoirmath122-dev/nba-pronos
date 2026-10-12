// HISTORIQUE de la popup : qui a été mis en avant récemment (plan §3.6). Pur.

import type { WeeklyPopupStatus } from "./types";

/** Nombre de popups publiées relues pour `cite_recemment`. */
export const HISTORY_DEPTH = 2;

/**
 * Joueurs cités par les 2 dernières popups PUBLISHED antérieures à `weekEnd`.
 * Une popup retirée (RETRACTED) ne compte pas, ni une régénération.
 */
export function recentlyFeatured(
  rows: readonly { week_end_date: string; status: WeeklyPopupStatus; featured_user_ids: readonly string[] }[],
  weekEnd: string,
): Set<string> {
  const recent = rows
    .filter((r) => r.status === "PUBLISHED" && r.week_end_date < weekEnd)
    .sort((a, b) => (a.week_end_date < b.week_end_date ? 1 : a.week_end_date > b.week_end_date ? -1 : 0))
    .slice(0, HISTORY_DEPTH);
  const ids = new Set<string>();
  for (const row of recent) for (const id of row.featured_user_ids) ids.add(id.toLowerCase());
  return ids;
}
