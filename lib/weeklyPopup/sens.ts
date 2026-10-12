// `seuil` et `sens` d'un candidat de flop (plan §3.3, règle « m » de la PR 3).
// Pur. Le résolveur compare en strict (`>` pour OVER, `<` pour UNDER) : un
// « plus de N » / « moins de N » est donc exactement ce qui a été vérifié.
// Ce que la structuration ne dit pas, c'est comment elle stocke « au moins N »
// (N ou N-1 en OVER) : un texte inclusif avec seuil entier est ambigu, donc
// écarté (seuil et sens à null) plutôt que de risquer un écart faux d'une unité.

import type { PopupBetRow, Sens } from "./types";

const COUNT_RELATION_SENS: Record<string, Sens> = {
  AT_LEAST: "au moins",
  MORE_THAN: "plus de",
  FEWER_THAN: "moins de",
  EXACTLY: "exactement",
};

/** Formulations qui rendent un seuil entier ambigu (inclusif ou non ?). */
export const INCLUSIVE_PHRASE_RE =
  /\bau[\s-]+(moins|plus|minimum|maximum)\b|\bou\s+(plus|moins|davantage|\+|égal|egal|supérieur|superieur|inférieur|inferieur)|(?<![\p{L}])(égal|egal)\s+ou\b|\b(minimum|maximum)\b|\bpas\s+(plus|moins)\s+de\b|(?<![\p{L}])à\s+partir\s+de\b|\bdès\b|\batteint|\batteindre|\d\s*\+|>=|<=|≥|≤/iu;

type SensSource = "fautes_techniques" | "quarts_exact" | "comparaison";

function sensWithSource(bet: PopupBetRow): { sens: Sens; source: SensSource } | null {
  const relation = bet.structured_technical_fouls_count?.count_relation;
  if (bet.structured_technical_fouls_count) {
    const sens = relation ? COUNT_RELATION_SENS[relation] : undefined;
    return sens ? { sens, source: "fautes_techniques" } : null;
  }
  const period = bet.structured_period;
  if (period?.outcome_kind === "QUARTERS_WON_COUNT" && period.exact_count === true) {
    return { sens: "exactement", source: "quarts_exact" };
  }
  if (bet.structured_comparison === "OVER") return { sens: "plus de", source: "comparaison" };
  if (bet.structured_comparison === "UNDER") return { sens: "moins de", source: "comparaison" };
  return null;
}

/** Sens tel que la structure le dit, sans la règle d'ambiguïté. */
export function computeSens(bet: PopupBetRow): Sens | null {
  return sensWithSource(bet)?.sens ?? null;
}

/** Seuil entier + sens venu d'OVER/UNDER + formulation inclusive dans le texte. */
export function isInclusiveAmbiguous(bet: PopupBetRow): boolean {
  const found = sensWithSource(bet);
  if (!found || found.source !== "comparaison") return false;
  const seuil = bet.structured_threshold;
  if (seuil === null || !Number.isFinite(seuil) || !Number.isInteger(seuil)) return false;
  return INCLUSIVE_PHRASE_RE.test(bet.description);
}

/** `seuil` jamais transformé ; `null/null` si inconnu ou ambigu. */
export function seuilEtSens(bet: PopupBetRow): { seuil: number | null; sens: Sens | null } {
  const sens = computeSens(bet);
  const seuil = bet.structured_threshold;
  if (sens === null || seuil === null || !Number.isFinite(seuil)) return { seuil: null, sens: null };
  if (isInclusiveAmbiguous(bet)) return { seuil: null, sens: null };
  return { seuil, sens };
}
