// Point d'entrée stable (barrel) pour la résolution automatique des paris
// IA calculables -- découpé le 09/09/2026 (p1-31, feuille de route Phase 1)
// en un fichier par catégorie de pari (lib/ai/resolve*Bets.ts, même
// découpage que lib/ai/structure*Bet.ts côté structuration) après avoir
// dépassé 2589 lignes dans un seul fichier. Ce fichier ne fait plus que
// ré-exporter -- les importeurs réels (app/api/resolve-bets/route.ts et les
// 15 fichiers de test co-localisés dans lib/ai/) continuent de fonctionner
// sans changement d'import.
export * from "./resolveBetsShared";
export * from "./resolveMatchBets";
export * from "./resolveSeriesBets";
export * from "./resolveMatchTotalBets";
export * from "./resolveTeamStatBets";
export * from "./resolveComparisonBets";
export * from "./resolveComboBets";
export * from "./resolvePeriodBets";
export * from "./resolveRosterSplitBets";
export * from "./resolveRosterCountBets";
export * from "./resolveSuperlativeBets";
export * from "./resolveGameEventBets";
export * from "./resolveTechnicalFoulsCountBets";
export * from "./resolveLastBasketBets";
export * from "./resolveBlockOnPlayerBets";
export * from "./resolveNotInMatchBets";

import { resolveCalculableBets } from "./resolveMatchBets";
import { resolveCalculableSeriesBets } from "./resolveSeriesBets";
import { resolveCalculableMatchTotalBets } from "./resolveMatchTotalBets";
import { resolveCalculableTeamStatBets } from "./resolveTeamStatBets";
import { resolveCalculableComparisonBets } from "./resolveComparisonBets";
import { resolveCalculableComboBets } from "./resolveComboBets";
import { resolveCalculablePeriodBets } from "./resolvePeriodBets";
import { resolveCalculableRosterSplitBets } from "./resolveRosterSplitBets";
import { resolveCalculableRosterCountBets } from "./resolveRosterCountBets";
import { resolveCalculableSuperlativeBets } from "./resolveSuperlativeBets";
import { resolveCalculableGameEventBets } from "./resolveGameEventBets";
import { resolveCalculableTechnicalFoulsCountBets } from "./resolveTechnicalFoulsCountBets";
import { resolveCalculableLastBasketBets } from "./resolveLastBasketBets";
import { resolveCalculableBlockOnPlayerBets } from "./resolveBlockOnPlayerBets";
import { resolveCalculableNotInMatchBets } from "./resolveNotInMatchBets";
import type { ResolveBetsSummary } from "./resolveBetsShared";

/** Agrège les 15 resolvers ci-dessus en un seul résumé -- extrait de
 *  /api/resolve-bets (22-26/08/2026) pour être réutilisable ailleurs sans
 *  dupliquer la liste (l'auto-révélation de l'Alpha NBA Cup s'en servait
 *  aussi, retirée le 04/10/2026 après la clôture de l'alpha). */
export async function resolveAllCalculableBets(): Promise<ResolveBetsSummary> {
  const summaries = await Promise.all([
    resolveCalculableBets(),
    resolveCalculableSeriesBets(),
    resolveCalculableMatchTotalBets(),
    resolveCalculableTeamStatBets(),
    resolveCalculableComparisonBets(),
    resolveCalculableComboBets(),
    resolveCalculablePeriodBets(),
    resolveCalculableRosterSplitBets(),
    resolveCalculableRosterCountBets(),
    resolveCalculableSuperlativeBets(),
    resolveCalculableGameEventBets(),
    resolveCalculableTechnicalFoulsCountBets(),
    resolveCalculableLastBasketBets(),
    resolveCalculableBlockOnPlayerBets(),
    resolveCalculableNotInMatchBets(),
  ]);
  return {
    resolved: summaries.flatMap((s) => s.resolved),
    skipped: summaries.flatMap((s) => s.skipped),
  };
}
