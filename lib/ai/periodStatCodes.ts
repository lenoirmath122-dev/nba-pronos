// Chantier "pari période" équipe (GAPS_OUVERTS.md, 24/08/2026) -- dernier
// morceau de la liste des 429 paris. 47 paris répartis en 8 sous-catégories
// (types_de_paris_playoffs_2026.md, "Pari période"), toutes dérivables du
// tableau de score par quart-temps déjà présent dans le payload Highlightly
// (matches.quarter_scores, cf. lib/sync/results.ts) -- pas de nouvelle
// donnée à synchroniser, contrairement à ce que GAPS_OUVERTS.md pensait
// initialement ("aucune donnée par quart-temps"). Fichier séparé de
// matchStatCodes.ts/teamStatCodes.ts (aucun invariant partagé), même
// convention.

export type PeriodCode = "Q1" | "Q2" | "Q3" | "Q4" | "H1" | "H2";

export const PERIOD_CODES: PeriodCode[] = ["Q1", "Q2", "Q3", "Q4", "H1", "H2"];

export const PERIOD_LABELS_FR: Record<PeriodCode, string> = {
  Q1: "1er quart-temps",
  Q2: "2e quart-temps",
  Q3: "3e quart-temps",
  Q4: "4e quart-temps",
  H1: "1ère mi-temps (Q1+Q2)",
  H2: "2ème mi-temps (Q3+Q4)",
};

// QUARTER_WINNER/HALF_WINNER : proba directe, pas de seuil (comme
// went_to_ot). QUARTERS_WON_COUNT : team+threshold+comparison (+
// exact_count). LEADS_HALF_RESULT : cible JOINTE entraînée directement (pas
// composée via indépendance comme COMBO -- mener à la mi-temps et gagner le
// match sont fortement corrélés), team=l'équipe qui doit mener,
// comparison=OVER (elle gagne le match) / UNDER (elle perd). MARGIN/
// TOTAL_POINTS : seuil numérique, team=null (symétrique). POINT_SHARE_PCT :
// fraction 0-1 (comme PERCENTAGE_STATS côté joueur), team obligatoire
// (perspective "pour" uniquement).
export type PeriodOutcomeKind =
  | "QUARTER_WINNER"
  | "HALF_WINNER"
  | "QUARTERS_WON_COUNT"
  | "LEADS_HALF_RESULT"
  | "MARGIN"
  | "TOTAL_POINTS"
  | "POINT_SHARE_PCT";

export const PERIOD_OUTCOME_KINDS: PeriodOutcomeKind[] = [
  "QUARTER_WINNER",
  "HALF_WINNER",
  "QUARTERS_WON_COUNT",
  "LEADS_HALF_RESULT",
  "MARGIN",
  "TOTAL_POINTS",
  "POINT_SHARE_PCT",
];

// Même principe que NO_THRESHOLD_STATS/NO_THRESHOLD_MATCH_STATS.
export const NO_THRESHOLD_PERIOD_OUTCOMES = new Set<PeriodOutcomeKind>(["QUARTER_WINNER", "HALF_WINNER"]);

// Outcomes où `team` doit être renseigné (ciblent une équipe précise) --
// MARGIN/TOTAL_POINTS restent symétriques (team=null), tous les autres
// visent une équipe.
export const TEAM_TARGETED_PERIOD_OUTCOMES = new Set<PeriodOutcomeKind>([
  "QUARTER_WINNER",
  "HALF_WINNER",
  "QUARTERS_WON_COUNT",
  "LEADS_HALF_RESULT",
  "POINT_SHARE_PCT",
]);

export const PERIOD_OUTCOME_LABELS_FR: Record<PeriodOutcomeKind, string> = {
  QUARTER_WINNER: "remporte ce quart-temps précis",
  HALF_WINNER: "mène/remporte cette mi-temps",
  QUARTERS_WON_COUNT: "nombre de quarts-temps remportés sur le match entier (period ignoré, toujours les 4)",
  LEADS_HALF_RESULT: "mène à la mi-temps ET le résultat final du match (gagne ou perd)",
  MARGIN: "écart de points entre les 2 équipes à la fin de la période",
  TOTAL_POINTS: "total de points combinés des 2 équipes sur la période",
  POINT_SHARE_PCT: "part des points TOTAUX du match marqués par l'équipe sur cette période",
};
