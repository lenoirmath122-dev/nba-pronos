// Palmarès hebdo d'un joueur (lot 4 du classement hebdo) : calcul pur, sans
// accès base. La lecture vit dans lib/queries/weeklyPalmares.ts.
//
// Une ligne de weekly_champions = un joueur champion d'une semaine d'une
// compétition. Plusieurs lignes pour la même (compétition, semaine) = co-
// champions (ex-aequo sur tous les départages).

export type PalmaresWeek = {
  competitionId: string;
  competitionName: string;
  /** Date calendaire (YYYY-MM-DD) du lundi qui clôt la semaine. */
  weekEndDate: string;
  points: number;
  isCoChampion: boolean;
};

export type PalmaresOwnRow = { competition_id: string; week_end_date: string; points: number };
export type PalmaresSameWeekRow = { competition_id: string; week_end_date: string };

/** Nom affiché quand la lecture de `competitions` a échoué ou ne renvoie rien. */
export const FALLBACK_COMPETITION_NAME = "Compétition";

const weekKey = (competitionId: string, weekEndDate: string): string => `${competitionId}|${weekEndDate}`;

/**
 * `sameWeekRows` : toutes les lignes champions des mêmes (compétition, semaine)
 * que les victoires du joueur, lui compris. `null` = lecture en erreur : on
 * n'affiche alors aucune mention co-champion plutôt qu'une mention fausse.
 *
 * `total` compte les victoires : une semaine partagée vaut 1, et deux
 * compétitions la même semaine valent 2.
 */
export function summarizePalmares(input: {
  own: PalmaresOwnRow[];
  sameWeekRows: PalmaresSameWeekRow[] | null;
  competitionNames: Map<string, string>;
}): { total: number; weeks: PalmaresWeek[] } {
  const championsPerWeek = new Map<string, number>();
  for (const row of input.sameWeekRows ?? []) {
    const key = weekKey(row.competition_id, row.week_end_date);
    championsPerWeek.set(key, (championsPerWeek.get(key) ?? 0) + 1);
  }

  const weeks: PalmaresWeek[] = input.own.map((row) => ({
    competitionId: row.competition_id,
    competitionName: input.competitionNames.get(row.competition_id) ?? FALLBACK_COMPETITION_NAME,
    weekEndDate: row.week_end_date,
    points: row.points,
    isCoChampion: (championsPerWeek.get(weekKey(row.competition_id, row.week_end_date)) ?? 0) >= 2,
  }));

  weeks.sort(
    (a, b) =>
      b.weekEndDate.localeCompare(a.weekEndDate) ||
      a.competitionName.localeCompare(b.competitionName, "fr") ||
      a.competitionId.localeCompare(b.competitionId),
  );

  return { total: weeks.length, weeks };
}

/** "2026-10-12" -> « 12 oct. 2026 » (date calendaire pure, pas de fuseau ;
 *  l'année est affichée car le palmarès couvre plusieurs saisons). */
export function formatWeekEndLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateKey}T12:00:00.000Z`));
}
