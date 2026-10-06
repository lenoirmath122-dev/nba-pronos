// Types de compétition et prédicats de comportement — module pur, sans import,
// partagé par le moteur de score, les requêtes et l'UI. Un nouveau type se
// décrit ici une fois plutôt que par des `=== "NBA_CUP"` éparpillés.

export type CompetitionType = "PLAYOFFS" | "NBA_CUP" | "DAILY_MATCH";

/** Le joueur remplit un bracket (le Match du jour n'en a pas). */
export function hasBracket(type: CompetitionType): boolean {
  return type !== "DAILY_MATCH";
}

/** Le pari SÉRIE existe (Playoffs uniquement). */
export function allowsSeriesBets(type: CompetitionType): boolean {
  return type === "PLAYOFFS";
}

/** Une « série » = un seul match (NBA Cup, Match du jour). */
export function isSingleMatchSeries(type: CompetitionType): boolean {
  return type !== "PLAYOFFS";
}

/** Liste blanche pour une valeur venue d'un FormData (jamais de `as` direct). */
export function isCompetitionType(value: unknown): value is CompetitionType {
  return value === "PLAYOFFS" || value === "NBA_CUP" || value === "DAILY_MATCH";
}
