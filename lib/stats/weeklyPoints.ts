import { addDays, isoWeekday } from "@/lib/recaps/period";

// Évolution des points par semaine (Stats > Évolution de « Mon profil »).
// Module pur : la lecture des snapshots est dans lib/queries/pointsEvolution.ts.
//
// Une « semaine » = lundi à dimanche (clé = date du lundi). Le total de fin de
// semaine d'un joueur est son dernier snapshot de la semaine ; la semaine en
// cours utilise les totaux en direct (user_scores). Points de la semaine = total
// de fin de semaine moins celui de la semaine précédente (0 avant la première).
// Le rang est calculé dans la portée choisie (général ou ligue) sur les seuls
// points : ex-aequo = rang partagé, comme dans le classement.

export type WeekTotals = { weekStart: string; totals: Map<string, number> };

export type WeeklyPointsRow = {
  weekStart: string;
  points: number;
  cumulative: number;
  /** Rang dans la portée en fin de semaine ; null si indisponible. */
  rank: number | null;
  /** Points moyens gagnés cette semaine par les joueurs de la portée. */
  scopeAverage: number | null;
  isCurrent: boolean;
};

/** Lundi (clé AAAA-MM-JJ) de la semaine qui contient `dateKey`. */
export function mondayOf(dateKey: string): string {
  return addDays(dateKey, -(isoWeekday(dateKey) - 1));
}

function rankOf(userId: string, totals: Map<string, number>): number | null {
  const mine = totals.get(userId);
  if (mine === undefined) return null;
  let better = 0;
  for (const value of totals.values()) if (value > mine) better += 1;
  return better + 1;
}

export function buildWeeklyPoints(userId: string, weeks: WeekTotals[], currentWeekStart: string): WeeklyPointsRow[] {
  const rows: WeeklyPointsRow[] = [];
  let previous = new Map<string, number>();
  for (const week of weeks) {
    const mine = week.totals.get(userId);
    if (mine === undefined) {
      previous = week.totals;
      continue;
    }
    let sum = 0;
    let count = 0;
    for (const [id, total] of week.totals) {
      sum += total - (previous.get(id) ?? 0);
      count += 1;
    }
    rows.push({
      weekStart: week.weekStart,
      points: mine - (previous.get(userId) ?? 0),
      cumulative: mine,
      rank: rankOf(userId, week.totals),
      scopeAverage: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
      isCurrent: week.weekStart === currentWeekStart,
    });
    previous = week.totals;
  }
  return rows;
}
