// Constantes de la popup hebdomadaire (lot 5, plan §2 et §3). Pur, sans I/O.

export const POPUP_LLM_MODEL_DEFAULT = "claude-sonnet-5-5";

/** Modèle des deux rôles ; `POPUP_LLM_MODEL` surcharge (sans redéploiement de code). */
export function popupModel(): string {
  return process.env.POPUP_LLM_MODEL?.trim() || POPUP_LLM_MODEL_DEFAULT;
}

/** Version des prompts, stockée dans `weekly_popups.prompt_version`. */
export const PROMPT_VERSION = "redacteur-v5/classifieur-v1";

export const ROLES = {
  classifier: { callSite: "popupClassifier", effort: "low", maxTokens: 8_000, timeoutMs: 25_000 },
  redacteur: { callSite: "popupRedacteur", effort: "medium", maxTokens: 16_000, timeoutMs: 45_000 },
} as const;

export const MAX_ATTEMPTS = 3;
export const BACKOFF_MS = [2_000, 5_000];
/** Une tentative ne démarre que s'il reste au moins ce délai (retry.ts). */
export const MIN_REMAINING_MS = 15_000;
/** Réservé à l'écriture finale et au push : retiré du timeout de chaque appel. */
export const FINALIZE_RESERVE_MS = 10_000;
export const MIN_CALL_TIMEOUT_MS = 5_000;
/** Taille des paquets du repli unitaire du classifieur. */
export const UNIT_FALLBACK_PARALLEL = 6;

/**
 * Doit égaler les littéraux `export const maxDuration` de /api/recaps et de
 * /admin/competitions (un segment config doit être statique : `config.test.ts`
 * relit les deux fichiers).
 */
export const ROUTE_MAX_DURATION_S = 300;
/** Démarrage à froid, écriture finale et push : retiré de l'échéance. */
export const DEADLINE_SAFETY_MARGIN_MS = 30_000;

/** Une ligne GENERATING plus vieille est considérée abandonnée. */
export const STALE_GENERATING_MS = 10 * 60_000;
/** Au-delà, le cron ne génère plus tout seul (rattrapage volontaire en admin). */
export const AUTO_GENERATION_MAX_AGE_MS = 36 * 3_600_000;

export const BLOCK_CAPS = { top: 5, flop: 8, refuse: 5 } as const;
export const PER_USER_PER_BLOCK = 2;
export const TEXT_MAX_CHARS = 280;
/** Niveau 1 de semaine pauvre : moins de paris WON/LOST/REJECTED = repli sans LLM. */
export const POOR_WEEK_MIN_BETS = 3;
export const LOAD_PAGE_SIZE = 300;
export const LOAD_MAX_ROWS = 3_000;

/** Limites de mots par bloc (v5) ; avertissement à +20 %, erreur à +50 %. */
export const WORD_LIMITS = { titre: 8, champion: 30, top: 45, flop: 50, refuse: 40, cta: 15 } as const;
export const TOTAL_WORD_LIMIT = 180;
export const WORD_WARN_RATIO = 1.2;
export const WORD_ERROR_RATIO = 1.5;

export const ATTEMPTS_KEPT = 20;

/** Échéance absolue d'une génération démarrée à `startMs` (début de la requête). */
export function deadlineFrom(startMs: number): number {
  return startMs + ROUTE_MAX_DURATION_S * 1000 - DEADLINE_SAFETY_MARGIN_MS;
}

/** Timeout d'un appel : celui du rôle, borné par ce qu'il reste avant l'échéance. */
export function boundedTimeoutMs(roleTimeoutMs: number, deadlineMs: number, nowMs: number): number {
  const room = deadlineMs - nowMs - FINALIZE_RESERVE_MS;
  return Math.max(MIN_CALL_TIMEOUT_MS, Math.min(roleTimeoutMs, room));
}
