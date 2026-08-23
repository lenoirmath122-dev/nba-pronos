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
export type TeamStatCode = "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "oreb";

export const TEAM_STAT_CODES: TeamStatCode[] = ["pts", "reb", "ast", "fg3m", "stl", "blk", "oreb"];

export const TEAM_STAT_LABELS_FR: Record<TeamStatCode, string> = {
  pts: "points de l'équipe",
  reb: "rebonds de l'équipe",
  ast: "passes décisives de l'équipe",
  fg3m: "3-points réussis de l'équipe",
  stl: "interceptions de l'équipe",
  blk: "contres de l'équipe",
  oreb: "rebonds offensifs de l'équipe",
};
