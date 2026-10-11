import { parisDateKey } from "@/lib/dates/paris";
import { addDays, isoWeekday, recapBoundaryIso } from "@/lib/recaps/period";

// Classement hebdomadaire (lot 1) : semaine lundi 10h Paris -> lundi 10h
// Paris. Points de la semaine = snapshot du lundi n − snapshot du lundi n-1.
// Module pur (aucun accès base), réutilisable par la vue Semaine du lot 2.

export type WeeklySnapshotRow = {
  user_id: string;
  total_points: number;
  correct_match_winners: number | null;
  exact_margins: number | null;
};

export type WeeklyStanding = {
  userId: string;
  rank: number;
  points: number;
  /** Null quand le départage est indisponible (snapshot d'avant le lot 0). */
  correctMatchWinners: number | null;
  exactMargins: number | null;
};

/** Lundi ("YYYY-MM-DD", Paris) qui clôt la dernière semaine terminée à
 *  `nowMs` : aujourd'hui si c'est un lundi passé 10h, sinon le lundi
 *  précédent. */
export function weekEndFor(nowMs: number): string {
  const today = parisDateKey(nowMs);
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const closed = nowMs >= Date.parse(recapBoundaryIso(monday));
  return closed ? monday : addDays(monday, -7);
}

export type WeekBoundsInput = {
  weekEnd: string;
  /** Premier snapshot daté >= weekEnd. */
  earliestOnOrAfterEnd: string | null;
  /** `end_snapshot_date` de la semaine figée précédente (weekEnd − 7). */
  previousFreezeEndDate: string | null;
  /** Dernier snapshot daté <= weekEnd − 7. */
  latestOnOrBeforeStart: string | null;
};

export type WeekBounds =
  | { ok: true; start: string; end: string; endLate: boolean; baselineLate: boolean }
  | {
      ok: false;
      reason:
        | "snapshot de fin absent"
        | "première semaine (pas de snapshot de référence)"
        | "départ postérieur ou égal à la fin";
    };

/** Choisit les deux snapshots de la semaine, sans requête. La semaine
 *  précédente figée fait foi pour le départ : aucun point perdu ni compté
 *  deux fois quand un snapshot a été pris en retard. */
export function resolveWeekBounds(input: WeekBoundsInput): WeekBounds {
  const { weekEnd, earliestOnOrAfterEnd, previousFreezeEndDate, latestOnOrBeforeStart } = input;
  if (!earliestOnOrAfterEnd) return { ok: false, reason: "snapshot de fin absent" };

  const start = previousFreezeEndDate ?? latestOnOrBeforeStart;
  if (!start) return { ok: false, reason: "première semaine (pas de snapshot de référence)" };
  // Ex. un snapshot forcé avant 10 h un lundi, daté du lundi suivant.
  if (start >= earliestOnOrAfterEnd) return { ok: false, reason: "départ postérieur ou égal à la fin" };

  return {
    ok: true,
    start,
    end: earliestOnOrAfterEnd,
    endLate: earliestOnOrAfterEnd !== weekEnd,
    baselineLate: previousFreezeEndDate === null && start !== addDays(weekEnd, -7),
  };
}

/** Fin moins début. Absent du début = 0/0/0 (inscrit en cours de semaine,
 *  `user_scores` n'a pas de ligne avant le premier geste). Absent de la fin =
 *  ignoré. Départage (bons vainqueurs, puis écarts exacts) seulement si
 *  TOUTES les lignes des deux snapshots le renseignent, sinon classement aux
 *  points seuls. Rangs partagés 1, 2, 2, 4. */
export function computeWeeklyStandings(
  start: WeeklySnapshotRow[],
  end: WeeklySnapshotRow[],
): { standings: WeeklyStanding[]; tiebreakAvailable: boolean } {
  const tiebreakAvailable = [...start, ...end].every(
    (row) => row.correct_match_winners !== null && row.exact_margins !== null,
  );
  const base = new Map(start.map((row) => [row.user_id, row]));

  const rows = end.map((row) => {
    const before = base.get(row.user_id);
    return {
      userId: row.user_id,
      points: row.total_points - (before?.total_points ?? 0),
      correctMatchWinners: tiebreakAvailable
        ? (row.correct_match_winners ?? 0) - (before?.correct_match_winners ?? 0)
        : null,
      exactMargins: tiebreakAvailable ? (row.exact_margins ?? 0) - (before?.exact_margins ?? 0) : null,
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      (b.correctMatchWinners ?? 0) - (a.correctMatchWinners ?? 0) ||
      (b.exactMargins ?? 0) - (a.exactMargins ?? 0),
  );

  const sameKey = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    a.points === b.points && a.correctMatchWinners === b.correctMatchWinners && a.exactMargins === b.exactMargins;

  const standings: WeeklyStanding[] = [];
  rows.forEach((row, index) => {
    const rank = index === 0 || !sameKey(row, rows[index - 1]) ? index + 1 : standings[index - 1].rank;
    standings.push({ ...row, rank });
  });

  return { standings, tiebreakAvailable };
}

/** Tous les premiers rangs, à condition de plus de 0 point. */
export function pickWeeklyChampions(standings: WeeklyStanding[]): WeeklyStanding[] {
  return standings.filter((standing) => standing.rank === 1 && standing.points > 0);
}
