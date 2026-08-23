// Codes de stat visant UNE ÉQUIPE PRÉCISE (ex. "Boston aura 45+ rebonds")
// -- piece (a) du chantier paris equipe, suite (GAPS_OUVERTS.md, 23/08/2026).
// Distinct de matchStatCodes.ts (MATCH_STAT_CODES) : celui-ci reste
// symetrique match entier (ex. "90+ rebonds au total"), celui-ci vise une
// equipe -- 2 formes du meme pari, demandees explicitement par
// l'utilisateur ("les deux ! ca dependra de l'enonce"). Egalement distinct
// de statCodes.ts (STAT_CODES, joueur) -- meme raison de separation que
// matchStatCodes.ts (aucun invariant partage).

export type TeamStatCode = "reb";

export const TEAM_STAT_CODES: TeamStatCode[] = ["reb"];

export const TEAM_STAT_LABELS_FR: Record<TeamStatCode, string> = {
  reb: "rebonds de l'équipe",
};
