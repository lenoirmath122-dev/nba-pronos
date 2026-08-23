// Codes de stat de MATCH (pas JOUEUR) que le micro-service sait calculer --
// piece (a) du chantier paris equipe (GAPS_OUVERTS.md, cadre le 23/08/2026).
// Volontairement SEPARE de statCodes.ts (STAT_CODES) : ces 2 listes ne
// partagent aucun invariant ("1 stat code = 1 calcul par JOUEUR" pour
// STAT_CODES, utilise partout ailleurs -- Python compute_proba()/
// STATS_DISPONIBLES inclus -- casserait si on y melangeait une stat
// d'equipe). Un seul code pour l'instant (total_points), extensible
// proprement plus tard (piece (a) suite -- autres paris equipe).

export type MatchStatCode = "total_points";

export const MATCH_STAT_CODES: MatchStatCode[] = ["total_points"];

export const MATCH_STAT_LABELS_FR: Record<MatchStatCode, string> = {
  total_points: "points combinés du match (les 2 équipes additionnées)",
};
