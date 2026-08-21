// Les 12 codes de stat que le micro-service de proba (Cadrage/Stats/service,
// projet-data-nba.md) sait calculer — DOIVENT rester synchronisés à la main
// avec STATS_DISPONIBLES côté service (Python, pas de génération partagée
// entre les 2 dépôts/langages). Utilisé à la fois pour guider l'extraction
// IA (structureBet.ts) et pour l'appel au service (statsService.ts).

export type StatCode = "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "min" | "dd" | "td" | "ft" | "fg" | "fg3";

export const STAT_CODES: StatCode[] = ["pts", "reb", "ast", "fg3m", "stl", "blk", "min", "dd", "td", "ft", "fg", "fg3"];

// Stats sans seuil (probabilité directe, pas de "> X") — dd/td dans
// tester_modele.py CLASSIFIER_STATS.
export const NO_THRESHOLD_STATS = new Set<StatCode>(["dd", "td"]);

// Stats en pourcentage (seuil = fraction 0-1, ex. 0.85 pour "85%") — reste
// des stats comptées (seuil = valeur brute, ex. 25 points).
export const PERCENTAGE_STATS = new Set<StatCode>(["ft", "fg", "fg3"]);

export const STAT_LABELS_FR: Record<StatCode, string> = {
  pts: "points",
  reb: "rebonds",
  ast: "passes décisives",
  fg3m: "3-points réussis",
  stl: "interceptions",
  blk: "contres",
  min: "minutes jouées",
  dd: "double-double",
  td: "triple-double",
  ft: "% aux lancers francs",
  fg: "% aux tirs",
  fg3: "% à 3-points",
};
