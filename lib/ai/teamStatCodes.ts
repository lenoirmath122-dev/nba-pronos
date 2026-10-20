// Codes de stat visant UNE ÉQUIPE PRÉCISE (ex. "Boston aura 45+ rebonds")
// -- piece (a) du chantier paris equipe, suite (GAPS_OUVERTS.md, 23/08/2026).
// Distinct de matchStatCodes.ts (MATCH_STAT_CODES) : celui-ci reste
// symetrique match entier (ex. "90+ rebonds au total"), celui-ci vise une
// equipe -- 2 formes du meme pari, demandees explicitement par
// l'utilisateur ("les deux ! ca dependra de l'enonce"). Egalement distinct
// de statCodes.ts (STAT_CODES, joueur) -- meme raison de separation que
// matchStatCodes.ts (aucun invariant partage).

// "pts" ajoute le 23/08/2026 (extension "faciles",
// types_de_paris_playoffs_2026.md, catégorie "Points équipe") --
// UNIQUEMENT ici (forme "équipe précise") : la forme combinée existe déjà
// sous "total_points" (matchStatCodes.ts, endpoint dédié), pas de
// "total_pts" ajouté (pas de modèle entraîné pour cette forme -- inutile,
// total_points fait déjà le travail).
// "oreb" ajoutee le meme jour (categorie "Rebonds offensifs equipe" --
// forme equipe precise, meme modele own/opp que reb/ast/fg3m/stl/blk).

// ft/fg/fg3 ajoutees le 24/08/2026 (chantier "% tir equipe", GAPS_OUVERTS.md,
// derniere piece du tier "nouveau mecanisme reutilisable") -- SEULES stats
// de cette liste ou `threshold` est une FRACTION 0-1 (comme PERCENTAGE_STATS
// cote joueur, statCodes.ts), pas une valeur comptee. Voir
// TEAM_PERCENTAGE_STATS ci-dessous.
// "fga" ajoutee le 24/08/2026 (chantier "petits gains groupes",
// GAPS_OUVERTS.md, categorie "Comparaison volume tirs equipe") --
// team_fga.joblib desormais entraine (meme recette train_team_stats_model.py
// que les autres stats comptees d'equipe). Debloque au passage la
// comparaison de volume de tirs (COMPARISON_TEAM_STAT_CODES = TEAM_STAT_CODES
// au complet, comparisonCodes.ts).
// "tov" ajoutee le 06/09/2026 (GAPS_OUVERTS.md, "pertes de balle" --
// demandee explicitement par l'utilisateur en testant "Les Warriors font
// au moins 5 pertes de balle") -- meme patron mecanique que oreb ci-dessus.
export type TeamStatCode =
  | "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "oreb" | "ft" | "fg" | "fg3" | "fga" | "tov";

export const TEAM_STAT_CODES: TeamStatCode[] = [
  "pts", "reb", "ast", "fg3m", "stl", "blk", "oreb", "ft", "fg", "fg3", "fga", "tov",
];

// Meme role que PERCENTAGE_STATS (statCodes.ts, cote joueur) -- threshold
// est une fraction 0-1 pour ces 3 stats, une valeur brute pour les autres.
export const TEAM_PERCENTAGE_STATS = new Set<TeamStatCode>(["ft", "fg", "fg3"]);

export const TEAM_STAT_LABELS_FR: Record<TeamStatCode, string> = {
  pts: "points de l'équipe",
  reb: "rebonds de l'équipe",
  ast: "passes décisives de l'équipe",
  fg3m: "3-points réussis de l'équipe",
  stl: "interceptions de l'équipe",
  blk: "contres de l'équipe",
  oreb: "rebonds offensifs de l'équipe",
  ft: "pourcentage aux lancers francs de l'équipe (FT%)",
  fg: "pourcentage au tir de l'équipe (FG%)",
  fg3: "pourcentage à 3-points de l'équipe (3P%)",
  fga: "tirs tentés de l'équipe",
  tov: "pertes de balle de l'équipe",
};

// Pseudo-stat "win" (S4, Lot 1, 20/10/2026) : valide UNIQUEMENT dans une
// condition combo d'ÉQUIPE (kind team1/team2), seule, sans seuil -- OVER =
// l'équipe gagne le match, UNDER = elle le perd (pas de nul en NBA).
// Volontairement HORS de TEAM_STAT_CODES : ce tableau alimente les paris
// équipe et la comparaison (COMPARISON_TEAM_STAT_CODES), où "win" n'a pas
// de sens. Élargit l'enum `stats` du schéma combo, pas de nouveau champ
// (schéma partagé au plafond de grammaire de l'API).
export const COMBO_WIN_STAT = "win";

// Pseudo-stat "margin" (S3, Lot 1) : écart final SIGNÉ d'une équipe (ses
// points - ceux de l'adversaire, prolongation comprise), dans une condition
// combo d'ÉQUIPE seule, avec seuil (négatif possible). Couvre « gagne de 10+ »
// (AT_LEAST 10), le handicap (« +5,5 » = OVER -5,5 ; « -5,5 » = OVER 5,5) et
// les tranches (2 conditions). Mêmes règles que "win" : hors TEAM_STAT_CODES.
export const COMBO_MARGIN_STAT = "margin";

// Pseudo-stat "starter" (S8, Lot 1) : titulaire ou remplaçant, dans une
// condition combo de JOUEUR (kind PLAYER, un seul joueur), seule dans stats,
// sans seuil -- OVER = titulaire, UNDER = remplaçant. Lue sur
// stats_box_scores.position ("" = remplaçant). Un joueur qui ne joue pas rend
// la condition fausse. Hors TEAM_STAT_CODES et hors STAT_CODES.
export const COMBO_STARTER_STAT = "starter";

// Pseudo-stats de période dans un combo d'ÉQUIPE (S4, fin, 20/10/2026) : le
// combo « tirent à 32 % à 3 points ET remportent les 4 quarts-temps » mêle
// une condition match entier et une condition de période. Mêmes règles que
// "win" : seule dans sa condition (kind team1/team2), hors de TEAM_STAT_CODES.
// - "qwon" : nombre de quarts-temps remportés (0-4), threshold + comparison ;
// - "win_q1".."win_h2" : remporte cette période, sans seuil (OVER = remporte,
//   UNDER = ne remporte pas).
export const COMBO_QUARTERS_WON_STAT = "qwon";
export const COMBO_PERIOD_WIN_STATS = ["win_q1", "win_q2", "win_q3", "win_q4", "win_h1", "win_h2"] as const;
export const COMBO_PERIOD_STATS: readonly string[] = [COMBO_QUARTERS_WON_STAT, ...COMBO_PERIOD_WIN_STATS];

/** "win_q3" -> "Q3" ; null si ce n'est pas une pseudo-stat « remporte la période ». */
export function periodOfComboWinStat(stat: string): "Q1" | "Q2" | "Q3" | "Q4" | "H1" | "H2" | null {
  return (COMBO_PERIOD_WIN_STATS as readonly string[]).includes(stat)
    ? (stat.slice(4).toUpperCase() as "Q1" | "Q2" | "Q3" | "Q4" | "H1" | "H2")
    : null;
}
