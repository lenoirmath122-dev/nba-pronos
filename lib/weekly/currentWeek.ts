import { addDays, recapBoundaryIso } from "@/lib/recaps/period";
import { weekEndFor, type WeeklySnapshotRow } from "@/lib/weekly/standings";

// Semaine EN COURS du classement hebdo (lot 2) : lundi 10h Paris -> lundi 10h
// Paris suivant. Points = `user_scores` actuel moins le snapshot de début.
// Module pur (aucun accès base) ; la lecture est dans
// lib/queries/weeklyLeaderboard.ts.

export type CurrentWeekStartInput = {
  /** Lundi qui ouvre la semaine en cours (`weekEndFor(now)`). */
  weekStart: string;
  /** `end_snapshot_date` de la semaine figée qui s'est terminée à `weekStart`. */
  frozenEndDate: string | null;
  /** Premier snapshot daté >= weekStart. */
  earliestOnOrAfterStart: string | null;
  /** Existe-t-il un snapshot daté < weekStart ? */
  anySnapshotBefore: boolean;
};

export type CurrentWeekStart =
  /** `start: null` = aucun snapshot du tout : la compétition vient de
   *  démarrer, tout le monde part de 0. */
  | { ok: true; start: string | null; late: boolean }
  /** Des snapshots existent mais aucun depuis le lundi (cron pas encore
   *  passé) : replier sur un snapshot plus ancien recompterait les points de
   *  la semaine précédente. */
  | { ok: false; reason: "snapshot de début absent" };

export function resolveCurrentWeekStart(input: CurrentWeekStartInput): CurrentWeekStart {
  const { weekStart, frozenEndDate, earliestOnOrAfterStart, anySnapshotBefore } = input;
  const start = frozenEndDate ?? earliestOnOrAfterStart;
  if (start) return { ok: true, start, late: start !== weekStart };
  if (anySnapshotBefore) return { ok: false, reason: "snapshot de début absent" };
  return { ok: true, start: null, late: false };
}

type ScoreRow = {
  user_id: string;
  total_points: number;
  correct_match_winners: number;
  exact_margins: number;
};

/** `user_scores` vu comme un snapshot de fin de semaine. */
export function scoresToSnapshotRows(rows: ScoreRow[]): WeeklySnapshotRow[] {
  return rows.map((row) => ({
    user_id: row.user_id,
    total_points: row.total_points,
    correct_match_winners: row.correct_match_winners,
    exact_margins: row.exact_margins,
  }));
}

/** Instant UTC (ISO) du prochain lundi 10h Paris : fin de la semaine en cours. */
export function nextWeekBoundaryIso(nowMs: number): string {
  return recapBoundaryIso(addDays(weekEndFor(nowMs), 7));
}

/** « Fin dans 2 j 5 h » / « Fin dans 3 h » / « Fin dans moins d'1 h ».
 *  Arrondi à l'heure : le rendu est serveur, pas de précision trompeuse. */
export function countdownLabel(nowMs: number, endIso: string): string {
  const diffMs = Date.parse(endIso) - nowMs;
  if (diffMs <= 0) return "Mise à jour imminente";
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Fin dans moins d'1 h";
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days === 0) return `Fin dans ${hours} h`;
  return rest === 0 ? `Fin dans ${days} j` : `Fin dans ${days} j ${rest} h`;
}

/** "2026-10-12" -> « lun. 12 oct. » (date calendaire pure, pas de fuseau). */
export function formatDayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

/** « A », « A et B », « A, B et C ». */
export function formatChampionNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}
