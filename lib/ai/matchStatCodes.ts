// Codes de stat de MATCH (pas JOUEUR, symetriques -- pas de notion
// d'equipe visee) que le micro-service sait calculer -- piece (a) du
// chantier paris equipe (GAPS_OUVERTS.md, cadre le 23/08/2026).
// Volontairement SEPARE de statCodes.ts (STAT_CODES) : ces 2 listes ne
// partagent aucun invariant ("1 stat code = 1 calcul par JOUEUR" pour
// STAT_CODES, utilise partout ailleurs -- Python compute_proba()/
// STATS_DISPONIBLES inclus -- casserait si on y melangeait une stat
// d'equipe). Egalement distinct de teamStatCodes.ts (TEAM_STAT_CODES) :
// celui-ci vise UNE equipe precise (ex. "Boston 45+ rebonds"), celui-la
// reste symetrique match entier (ex. "90+ rebonds au total") -- 2 formes du
// meme pari, demandees explicitement par l'utilisateur (23/08/2026).
// total_reb ajoute le meme jour (rebonds combines, a cote de total_points).

export type MatchStatCode = "total_points" | "total_reb";

export const MATCH_STAT_CODES: MatchStatCode[] = ["total_points", "total_reb"];

export const MATCH_STAT_LABELS_FR: Record<MatchStatCode, string> = {
  total_points: "points combinés du match (les 2 équipes additionnées)",
  total_reb: "rebonds combinés du match (les 2 équipes additionnées)",
};
