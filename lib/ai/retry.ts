// Relances applicatives des appels LLM de la popup hebdomadaire (lot 5, plan
// §2 « Relances par l'application »). Le SDK est en `maxRetries: 0` : la
// décision de relancer, l'attente et le budget de temps sont ICI, purs et
// testables (horloge et attente injectées). Aucune I/O.

export type RetryOptions<T> = {
  maxAttempts: number;
  /** Échéance absolue (ms, même horloge que `now`). */
  deadlineMs: number;
  /** Attente avant la tentative n+1 : `backoffMs[n-1]`, le dernier élément
   *  sert ensuite de plancher. */
  backoffMs: number[];
  /** Une tentative n'est lancée que s'il reste au moins ce temps (défaut 15 s). */
  minRemainingMs?: number;
  /** Défaut : `result.retriable === true`. */
  shouldRetry?: (result: T) => boolean;
  /** `retry-after` du serveur, en ms, si présent ; respecté s'il tient dans le
   *  budget. Défaut : `result.retryAfterMs` (voir LlmCallResult). */
  retryAfterMs?: (result: T) => number | null | undefined;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type RetryOutcome<T> = {
  /** Dernier résultat obtenu ; `null` si aucune tentative n'a pu démarrer. */
  result: T | null;
  attempts: number;
  /** Vrai si on s'est arrêté faute de temps (et non faute de motif de relance
   *  ou de tentatives) : le brouillon porte alors le code `budget`. */
  budgetExhausted: boolean;
};

export const DEFAULT_MIN_REMAINING_MS = 15_000;

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Exécute `fn(attempt)` (attempt commence à 1) jusqu'à un résultat non
 * relançable, `maxAttempts` tentatives ou l'épuisement du budget de temps.
 * `fn` ne doit pas lever : les erreurs sont des résultats (voir claudeJson).
 */
export async function withRetries<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions<T>,
): Promise<RetryOutcome<T>> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;
  const minRemaining = opts.minRemainingMs ?? DEFAULT_MIN_REMAINING_MS;
  const shouldRetry =
    opts.shouldRetry ?? ((r: T) => (r as { retriable?: boolean } | null)?.retriable === true);

  let result: T | null = null;
  let attempts = 0;

  while (attempts < opts.maxAttempts) {
    if (opts.deadlineMs - now() < minRemaining) {
      return { result, attempts, budgetExhausted: true };
    }
    attempts += 1;
    result = await fn(attempts);

    if (!shouldRetry(result)) return { result, attempts, budgetExhausted: false };
    if (attempts >= opts.maxAttempts) break;

    const backoff = opts.backoffMs[Math.min(attempts - 1, opts.backoffMs.length - 1)] ?? 0;
    const serverWait =
      (opts.retryAfterMs
        ? opts.retryAfterMs(result)
        : (result as { retryAfterMs?: number } | null)?.retryAfterMs) ?? 0;
    const wait = Math.max(backoff, serverWait > 0 ? serverWait : 0);
    // L'attente + la tentative suivante doivent tenir dans le budget.
    if (opts.deadlineMs - (now() + wait) < minRemaining) {
      return { result, attempts, budgetExhausted: true };
    }
    if (wait > 0) await sleep(wait);
  }

  return { result, attempts, budgetExhausted: false };
}
