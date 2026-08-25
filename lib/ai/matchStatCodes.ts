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
// total_ast/total_fg3m/total_stl/total_blk generalises dans la foulee
// (23/08/2026, meme patron exactement) -- cf. teamStatCodes.ts pour la
// forme "equipe precise" equivalente de chacune de ces 4 stats.

// total_oreb ajoute le 23/08/2026 (extension "faciles", categorie
// "Rebonds offensifs equipe" forme combinee).

// went_to_ot ajoute le 24/08/2026 (chantier "prolongation", GAPS_OUVERTS.md)
// -- SEULE stat de cette liste sans seuil (probabilite directe que LE match
// aille en prolongation, meme principe que dd/td cote joueur -- voir
// NO_THRESHOLD_MATCH_STATS ci-dessous).

// total_timeouts/had_backcourt_turnover ajoutees le 25/08/2026 (etape 5 du
// plan de reprise post-audit, GAPS_OUVERTS.md, chantier "evenements de
// match") -- "aucun temps mort pris par les 2 equipes"/"au moins un retour
// en zone" se glissent TELS QUELS dans le mecanisme MATCH_TOTAL deja en
// place (total_timeouts = regression comme total_points, seuil=1/UNDER
// approxime "exactement 0" -- meme principe deja accepte pour le DNP
// roster-wide, etape 3 ; had_backcourt_turnover = classifieur direct comme
// went_to_ot, PAS de seuil).
export type MatchStatCode =
  | "total_points" | "total_reb" | "total_ast" | "total_fg3m" | "total_stl" | "total_blk" | "total_oreb"
  | "went_to_ot" | "total_timeouts" | "had_backcourt_turnover";

export const MATCH_STAT_CODES: MatchStatCode[] = [
  "total_points", "total_reb", "total_ast", "total_fg3m", "total_stl", "total_blk", "total_oreb", "went_to_ot",
  "total_timeouts", "had_backcourt_turnover",
];

// Meme principe que NO_THRESHOLD_STATS (statCodes.ts, dd/td cote joueur) --
// went_to_ot/had_backcourt_turnover n'ont ni seuil ni OVER/UNDER, juste une
// probabilite directe.
export const NO_THRESHOLD_MATCH_STATS = new Set<MatchStatCode>(["went_to_ot", "had_backcourt_turnover"]);

export const MATCH_STAT_LABELS_FR: Record<MatchStatCode, string> = {
  total_points: "points combinés du match (les 2 équipes additionnées)",
  total_reb: "rebonds combinés du match (les 2 équipes additionnées)",
  total_ast: "passes décisives combinées du match (les 2 équipes additionnées)",
  total_fg3m: "3-points réussis combinés du match (les 2 équipes additionnées)",
  total_stl: "interceptions combinées du match (les 2 équipes additionnées)",
  total_blk: "contres combinés du match (les 2 équipes additionnées)",
  total_oreb: "rebonds offensifs combinés du match (les 2 équipes additionnées)",
  went_to_ot: "le match ira en prolongation",
  total_timeouts: "temps morts combinés du match (les 2 équipes additionnées)",
  had_backcourt_turnover: "au moins un retour en zone (violation de contre-attaque) durant le match",
};
