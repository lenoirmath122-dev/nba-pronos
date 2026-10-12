import { describe, expect, it } from "vitest";
import { withRetries } from "./retry";

type R = { ok: boolean; retriable: boolean; retryAfterMs?: number };

function harness(startMs = 0) {
  let t = startMs;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
    sleeps,
  };
}

describe("withRetries", () => {
  it("rend le résultat du premier coup s'il n'est pas relançable", async () => {
    const h = harness();
    const out = await withRetries<R>(async () => ({ ok: true, retriable: false }), {
      maxAttempts: 3,
      deadlineMs: 60_000,
      backoffMs: [2000, 5000],
      now: h.now,
      sleep: h.sleep,
    });
    expect(out).toMatchObject({ attempts: 1, budgetExhausted: false });
    expect(out.result?.ok).toBe(true);
    expect(h.sleeps).toEqual([]);
  });

  it("relance avec le backoff 2 s puis 5 s et s'arrête à maxAttempts", async () => {
    const h = harness();
    const out = await withRetries<R>(async () => ({ ok: false, retriable: true }), {
      maxAttempts: 3,
      deadlineMs: 120_000,
      backoffMs: [2000, 5000],
      now: h.now,
      sleep: h.sleep,
    });
    expect(out.attempts).toBe(3);
    expect(out.budgetExhausted).toBe(false);
    expect(h.sleeps).toEqual([2000, 5000]);
  });

  it("réussit à la deuxième tentative", async () => {
    const h = harness();
    const seen: number[] = [];
    const out = await withRetries<R>(
      async (attempt) => {
        seen.push(attempt);
        return { ok: attempt === 2, retriable: attempt !== 2 };
      },
      { maxAttempts: 3, deadlineMs: 60_000, backoffMs: [2000], now: h.now, sleep: h.sleep },
    );
    expect(seen).toEqual([1, 2]);
    expect(out.result?.ok).toBe(true);
  });

  it("ne lance aucune tentative s'il reste moins de 15 s", async () => {
    const h = harness();
    let calls = 0;
    const out = await withRetries<R>(
      async () => {
        calls += 1;
        return { ok: true, retriable: false };
      },
      { maxAttempts: 3, deadlineMs: 14_999, backoffMs: [2000], now: h.now, sleep: h.sleep },
    );
    expect(calls).toBe(0);
    expect(out).toEqual({ result: null, attempts: 0, budgetExhausted: true });
  });

  it("s'arrête (budget) quand il ne reste plus 15 s", async () => {
    const h = harness();
    const out = await withRetries<R>(
      async () => {
        h.advance(20_000);
        return { ok: false, retriable: true };
      },
      { maxAttempts: 3, deadlineMs: 40_000, backoffMs: [2000, 5000], now: h.now, sleep: h.sleep },
    );
    // Après la 1re tentative t=20 s : 40 - (20 + 2) = 18 s >= 15 -> 2e tentative ;
    // à t=42 s le budget est épuisé.
    expect(out.attempts).toBe(2);
    expect(out.budgetExhausted).toBe(true);
    expect(out.result?.ok).toBe(false);
  });

  it("respecte retry-after s'il tient dans le budget, sinon s'arrête", async () => {
    const h = harness();
    const fits = await withRetries<R>(async () => ({ ok: false, retriable: true, retryAfterMs: 9000 }), {
      maxAttempts: 2,
      deadlineMs: 60_000,
      backoffMs: [2000],
      retryAfterMs: (r) => r.retryAfterMs,
      now: h.now,
      sleep: h.sleep,
    });
    expect(fits.attempts).toBe(2);
    expect(h.sleeps).toEqual([9000]);

    const h2 = harness();
    const tooLong = await withRetries<R>(async () => ({ ok: false, retriable: true, retryAfterMs: 50_000 }), {
      maxAttempts: 2,
      deadlineMs: 60_000,
      backoffMs: [2000],
      retryAfterMs: (r) => r.retryAfterMs,
      now: h2.now,
      sleep: h2.sleep,
    });
    expect(tooLong).toMatchObject({ attempts: 1, budgetExhausted: true });
    expect(h2.sleeps).toEqual([]);
  });

  it("lit result.retryAfterMs par défaut", async () => {
    const h = harness();
    await withRetries<R>(async () => ({ ok: false, retriable: true, retryAfterMs: 8000 }), {
      maxAttempts: 2,
      deadlineMs: 60_000,
      backoffMs: [2000],
      now: h.now,
      sleep: h.sleep,
    });
    expect(h.sleeps).toEqual([8000]);
  });

  it("accepte un shouldRetry personnalisé", async () => {
    const h = harness();
    const out = await withRetries<{ v: number }>(async () => ({ v: 1 }), {
      maxAttempts: 3,
      deadlineMs: 60_000,
      backoffMs: [0],
      shouldRetry: () => false,
      now: h.now,
      sleep: h.sleep,
    });
    expect(out.attempts).toBe(1);
  });
});
