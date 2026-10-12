import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { method: string; args: unknown[] };
const h = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; args: unknown[] }>,
  selectResult: { data: [] as Array<{ estimated_cost_usd: unknown }> | null, error: null as unknown },
  insertResult: { error: null as unknown },
  inserted: [] as Array<Record<string, unknown>>,
  throwOnFrom: false,
}));

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: () => {
      if (h.throwOnFrom) throw new Error("boom");
      const q: Record<string, unknown> = {};
      const chain = (method: string) => (...args: unknown[]) => {
        h.calls.push({ method, args });
        return q;
      };
      q.select = chain("select");
      q.gte = chain("gte");
      q.like = chain("like");
      q.not = chain("not");
      q.then = (resolve: (v: unknown) => void) => resolve(h.selectResult);
      q.insert = (row: Record<string, unknown>) => {
        h.inserted.push(row);
        return Promise.resolve(h.insertResult);
      };
      return q;
    },
  }),
}));

import {
  POPUP_DAILY_COST_CAP_USD,
  estimateCostUsd,
  estimateWorstCaseCostUsd,
  getTodaySpendUsd,
  recordAnthropicUsage,
} from "./usageTracking";

beforeEach(() => {
  h.calls.length = 0;
  h.inserted.length = 0;
  h.selectResult = { data: [], error: null };
  h.insertResult = { error: null };
  h.throwOnFrom = false;
});

describe("getTodaySpendUsd", () => {
  it("structuration (défaut) : exclut les call_site popup", async () => {
    h.selectResult = { data: [{ estimated_cost_usd: "0.5" }, { estimated_cost_usd: 0.25 }], error: null };
    expect(await getTodaySpendUsd()).toBeCloseTo(0.75);
    expect(h.calls).toContainEqual({ method: "not", args: ["call_site", "like", "popup%"] });
    expect(h.calls.find((c: Call) => c.method === "like")).toBeUndefined();
  });

  it("popup : filtre sur popup% et somme", async () => {
    h.selectResult = { data: [{ estimated_cost_usd: 0.1 }, { estimated_cost_usd: 0.2 }], error: null };
    expect(await getTodaySpendUsd("popup")).toBeCloseTo(0.3);
    expect(h.calls).toContainEqual({ method: "like", args: ["call_site", "popup%"] });
  });

  it("structuration : reste ouvert (0) en cas d'erreur", async () => {
    h.selectResult = { data: null, error: { message: "x" } };
    expect(await getTodaySpendUsd("structuration")).toBe(0);
    h.throwOnFrom = true;
    expect(await getTodaySpendUsd()).toBe(0);
  });

  it("popup : échoue fermé (Infinity) sur erreur, exception ou somme tronquée", async () => {
    h.selectResult = { data: null, error: { message: "x" } };
    expect(await getTodaySpendUsd("popup")).toBe(Number.POSITIVE_INFINITY);
    h.throwOnFrom = true;
    expect(await getTodaySpendUsd("popup")).toBe(Number.POSITIVE_INFINITY);
    h.throwOnFrom = false;
    h.selectResult = { data: Array.from({ length: 1000 }, () => ({ estimated_cost_usd: 0 })), error: null };
    expect(await getTodaySpendUsd("popup")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("recordAnthropicUsage", () => {
  const usage = { input_tokens: 1000, output_tokens: 500 };

  it("sans meta : seules les colonnes historiques (appelants existants intacts)", async () => {
    expect(await recordAnthropicUsage("structureBet", "claude-sonnet-5", usage)).toBe(true);
    expect(Object.keys(h.inserted[0]).sort()).toEqual(
      [
        "cache_creation_tokens",
        "cache_read_tokens",
        "call_site",
        "estimated_cost_usd",
        "input_tokens",
        "model",
        "output_tokens",
      ].sort(),
    );
  });

  it("avec meta : colonnes de journal et coût imposé", async () => {
    await recordAnthropicUsage("popupRedacteur", "claude-sonnet-5-5", usage, {
      status: "timeout",
      stopReason: null,
      requestId: "req_9",
      latencyMs: 4200,
      thinkingTokens: 80,
      attempt: 2,
      estimatedCostUsd: 0.17,
    });
    expect(h.inserted[0]).toMatchObject({
      call_site: "popupRedacteur",
      status: "timeout",
      stop_reason: null,
      request_id: "req_9",
      latency_ms: 4200,
      thinking_tokens: 80,
      attempt: 2,
      estimated_cost_usd: 0.17,
    });
  });

  it("renvoie false sans lever si l'insert échoue", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    h.insertResult = { error: { message: "colonne absente" } };
    expect(await recordAnthropicUsage("popupRedacteur", "claude-sonnet-5-5", usage, { status: "ok" })).toBe(false);
    spy.mockRestore();
  });
});

describe("tarif", () => {
  it("claude-sonnet-5-5 est tarifé (provisoirement comme sonnet-5)", () => {
    const u = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
    expect(estimateCostUsd("claude-sonnet-5-5", u)).toBe(12);
    expect(estimateCostUsd("claude-sonnet-5", u)).toBe(12);
  });

  it("modèle inconnu : tarif connu le plus cher", () => {
    expect(estimateCostUsd("modele-inconnu", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(2);
  });

  it("pire coût du rédacteur : ordre de grandeur du plan (~0,17 $)", () => {
    const worst = estimateWorstCaseCostUsd("claude-sonnet-5-5", 12_000, 16_000);
    expect(worst).toBeGreaterThan(0.15);
    expect(worst).toBeLessThan(0.2);
    expect(worst).toBeLessThan(POPUP_DAILY_COST_CAP_USD);
  });
});
