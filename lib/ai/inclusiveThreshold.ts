// Les moteurs de probabilité et de résolution comparent en STRICT (`> seuil` pour
// OVER, `< seuil` pour UNDER, cf. resolveBetsShared.computeOutcome). Un texte
// « au moins 25 points » / « 25 ou plus » / « au plus 3 » est INCLUSIF : le modèle
// IA ne fait plus l'arithmétique, il renseigne `inclusive` et ce module convertit
// en seuil strict équivalent pour les stats entières (OVER N inclusif -> > N-1,
// UNDER N inclusif -> < N+1).

/** Stats non entières (fractions, minutes) : pas de « N-1 » possible, on décale d'un epsilon. */
const NON_INTEGER_STATS = new Set(["ft", "fg", "fg3", "min"]);
const EPSILON = 1e-6;

export function applyInclusiveThreshold(
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  inclusive: boolean | null | undefined,
  stats: readonly string[],
): number | null {
  if (!inclusive || threshold === null || comparison === null) return threshold;
  // Stats non entières : une égalité exacte reste possible (1/2 aux lancers francs = 50 %). Le moteur
  // compare en strict, donc OVER N inclusif -> > N - epsilon (UNDER : < N + epsilon).
  if (stats.some((s) => NON_INTEGER_STATS.has(s))) {
    return comparison === "OVER" ? threshold - EPSILON : threshold + EPSILON;
  }
  // Stat entière avec seuil non entier (24,5) : strict et inclusif sont déjà équivalents.
  if (!Number.isInteger(threshold)) return threshold;
  return comparison === "OVER" ? threshold - 1 : threshold + 1;
}

/** Description du champ `inclusive`, partagée par tous les schémas de structuration IA. */
export const INCLUSIVE_DESCRIPTION =
  "true si le texte est INCLUSIF sur le seuil : \"au moins N\", \"N+\", \"N ou plus\" (OVER), \"au plus N\", \"N ou moins\" " +
  "(UNDER). Mettre alors threshold = N tel qu'écrit dans le texte (le code convertit en seuil strict, ne fais AUCUN N-1 toi-même). " +
  "false pour \"plus de N\"/\"moins de N\"/\"supérieur à\" (déjà stricts) et pour tout pari sans seuil.";

/** Variante sans champ supplémentaire (schéma structureBet, déjà au plafond de grammaire de l'API) :
 *  l'inclusivité est portée par la comparaison elle-même. */
export const THRESHOLD_COMPARISONS = ["OVER", "UNDER", "AT_LEAST", "AT_MOST"] as const;
export type ThresholdComparison = (typeof THRESHOLD_COMPARISONS)[number];

export const THRESHOLD_COMPARISON_DESCRIPTION =
  "OVER = strictement plus de N (plus de/supérieur à). UNDER = strictement moins de N. AT_LEAST = au moins N, N+, " +
  "N ou plus (inclusif). AT_MOST = au plus N, N ou moins (inclusif). threshold = N tel qu'écrit dans le texte, " +
  "jamais de N-1 ni N+1 de ta part (le code convertit).";

export function resolveInclusiveComparison(
  threshold: number | null,
  comparison: ThresholdComparison | null,
  stats: readonly string[],
): { threshold: number | null; comparison: "OVER" | "UNDER" | null } {
  if (comparison === null) return { threshold, comparison: null };
  const strict = comparison === "AT_LEAST" ? "OVER" : comparison === "AT_MOST" ? "UNDER" : comparison;
  const inclusive = comparison === "AT_LEAST" || comparison === "AT_MOST";
  return { threshold: applyInclusiveThreshold(threshold, strict, inclusive, stats), comparison: strict };
}
