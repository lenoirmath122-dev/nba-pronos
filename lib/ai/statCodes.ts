// Les 12 codes de stat que le micro-service de proba (Cadrage/Stats/service,
// projet-data-nba.md) sait calculer — DOIVENT rester synchronisés à la main
// avec STATS_DISPONIBLES côté service (Python, pas de génération partagée
// entre les 2 dépôts/langages). Utilisé à la fois pour guider l'extraction
// IA (structureBet.ts) et pour l'appel au service (statsService.ts).

// "fga"/"fg3a"/"oreb" ajoutees le 23/08/2026 (extension "faciles",
// types_de_paris_playoffs_2026.md, categories "Tentatives joueur" et
// "Rebonds offensifs equipe" forme joueur) -- stats a seuil comme
// pts/reb/etc, rien de special cote schema.
// "plus_minus" ajoutee le 24/08/2026 (chantier "petits gains groupes",
// GAPS_OUVERTS.md) -- deja une colonne brute (stats_box_scores.plus_minus),
// juste jamais entrainee comme cible dediee (plus_minus.joblib desormais
// present, meme recette train_stat_model.py que les autres stats comptees).
// "tech" ajoutee le 25/08/2026 (etape 5 du plan de reprise post-audit,
// GAPS_OUVERTS.md, chantier "evenements de match") -- probabilite DIRECTE
// (au moins 1 faute technique sur le match), meme principe que dd/td, cf.
// CLASSIFIER_STATS cote Python (tech.joblib, train_game_event_model.py).
export type StatCode =
  | "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "min" | "dd" | "td" | "ft" | "fg" | "fg3"
  | "fga" | "fg3a" | "oreb" | "plus_minus" | "tech";

export const STAT_CODES: StatCode[] = [
  "pts", "reb", "ast", "fg3m", "stl", "blk", "min", "dd", "td", "ft", "fg", "fg3", "fga", "fg3a", "oreb",
  "plus_minus", "tech",
];

// Stats sans seuil (probabilité directe, pas de "> X") — dd/td/tech dans
// tester_modele.py CLASSIFIER_STATS.
export const NO_THRESHOLD_STATS = new Set<StatCode>(["dd", "td", "tech"]);

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
  fga: "tirs tentés",
  fg3a: "tirs à 3-points tentés",
  oreb: "rebonds offensifs",
  plus_minus: "+/-",
  tech: "faute technique (au moins une)",
};
