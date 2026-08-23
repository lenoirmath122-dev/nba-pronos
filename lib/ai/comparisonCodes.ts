import { STAT_CODES, type StatCode } from "./statCodes";
import { TEAM_STAT_CODES, type TeamStatCode } from "./teamStatCodes";

// Codes utilisables dans un pari DUEL/COMPARAISON (24/08/2026,
// GAPS_OUVERTS.md, chantier comparaison/duel) -- restreint aux stats
// COMPTÉES avec une moyenne numérique (côté Python,
// supabase_context.py::_player_stat_mean_scale n'accepte que
// REGRESSION_STATS) : PAS dd/td (proba directe, pas de moyenne à
// comparer) ni ft/fg/fg3 (mécanisme Beta-Binomial différent, différence
// de 2 taux non modélisée pour l'instant).
export const COMPARISON_PLAYER_STAT_CODES: StatCode[] = STAT_CODES.filter(
  (code) => code !== "dd" && code !== "td" && code !== "ft" && code !== "fg" && code !== "fg3",
);

// Côté équipe : TEAM_STAT_CODES au complet, toutes supportent déjà
// team_{stat}.joblib (aucune restriction supplémentaire).
export const COMPARISON_TEAM_STAT_CODES: TeamStatCode[] = TEAM_STAT_CODES;
