// Motif de non-calcul d'un pari personnalisé (GAPS_OUVERTS.md, « Couverture
// des types de paris », étape 1-A) -- écrit dans bets.calculability_diagnosis
// à chaque is_calculable=false. Codes FERMÉS côté TypeScript seulement : la
// base ne vérifie que la forme du JSON (DATA-001, voir la migration
// 20261009090000), sinon un code ajouté ici avant sa migration ferait
// échouer l'écriture.

import { betFingerprint, betSkeleton, FINGERPRINT_VERSION } from "./betFingerprint";

export type NotCalculableReason =
  // Couverture : comptent pour la mesure des types non supportés.
  | "UNKNOWN_TYPE"
  | "ROUTE_MISMATCH"
  | "SERIES_SCOPE_UNSUPPORTED"
  | "UNSUPPORTED_STAT"
  | "NO_MODEL_FOR_PERIOD"
  // Qualité de la sortie IA.
  | "AI_INCOMPLETE"
  | "TEAM_UNRESOLVED"
  // Opérationnel : à exclure de la mesure de couverture.
  | "AI_COST_CAP"
  | "AI_UNAVAILABLE"
  | "STATS_NO_PREDICTION"
  | "MATCH_CONTEXT_MISSING"
  | "SERIES_CONTEXT_MISSING"
  | "MATCH_ID_MISSING";

export type NotCalculableGroup = "COVERAGE" | "AI_QUALITY" | "OPERATIONAL";

export const REASON_GROUP: Record<NotCalculableReason, NotCalculableGroup> = {
  UNKNOWN_TYPE: "COVERAGE",
  ROUTE_MISMATCH: "COVERAGE",
  SERIES_SCOPE_UNSUPPORTED: "COVERAGE",
  UNSUPPORTED_STAT: "COVERAGE",
  NO_MODEL_FOR_PERIOD: "COVERAGE",
  AI_INCOMPLETE: "AI_QUALITY",
  TEAM_UNRESOLVED: "AI_QUALITY",
  AI_COST_CAP: "OPERATIONAL",
  AI_UNAVAILABLE: "OPERATIONAL",
  STATS_NO_PREDICTION: "OPERATIONAL",
  MATCH_CONTEXT_MISSING: "OPERATIONAL",
  SERIES_CONTEXT_MISSING: "OPERATIONAL",
  MATCH_ID_MISSING: "OPERATIONAL",
};

/** Ce que l'IA a renvoyé, quand elle a tourné (jamais d'appel en plus). */
export type AiTrace = { bet_subject?: string | null; reasoning?: string | null } | null;

export const RAW_TEXT_MAX = 1000;
export const AI_REASONING_MAX = 500;

export type CalculabilityDiagnosis = {
  v: number;
  reason: NotCalculableReason;
  group: NotCalculableGroup;
  route: string;
  subject: string | null;
  raw_text: string;
  skeleton: string;
  fingerprint: string;
  ai_reasoning?: string;
};

/** Objet envoyé à la RPC (le champ `at` est posé par la base). */
export function buildCalculabilityDiagnosis(input: {
  reason: NotCalculableReason;
  rawText: string;
  route: string;
  ai?: AiTrace;
}): CalculabilityDiagnosis {
  const { reason, rawText, route, ai } = input;
  const diagnosis: CalculabilityDiagnosis = {
    v: FINGERPRINT_VERSION,
    reason,
    group: REASON_GROUP[reason],
    route,
    subject: ai?.bet_subject ?? null,
    raw_text: rawText.slice(0, RAW_TEXT_MAX),
    skeleton: betSkeleton(rawText),
    fingerprint: betFingerprint(rawText),
  };
  const reasoning = ai?.reasoning?.trim();
  if (reasoning) diagnosis.ai_reasoning = reasoning.slice(0, AI_REASONING_MAX);
  return diagnosis;
}
