import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  callClaudeJson,
  createRunBudget,
  type ClaudeResponseLike,
  type CreateFn,
  type RecordFn,
} from "./claudeJson";

const Schema = z.object({ ok: z.boolean() }).strict();

function response(over: Partial<ClaudeResponseLike> = {}): ClaudeResponseLike {
  return {
    content: [{ type: "text", text: '{"ok":true}' }],
    stop_reason: "end_turn",
    stop_details: null,
    model: "claude-sonnet-5-5",
    usage: { input_tokens: 1000, output_tokens: 500, output_tokens_details: { thinking_tokens: 120 } },
    _request_id: "req_1",
    ...over,
  };
}

function setup(create: CreateFn, over: { spend?: number | (() => Promise<number>); record?: RecordFn } = {}) {
  const record = vi.fn<RecordFn>(over.record ?? (async () => true));
  const spend =
    typeof over.spend === "function" ? over.spend : async () => (typeof over.spend === "number" ? over.spend : 0);
  const call = (extra: Partial<Parameters<typeof callClaudeJson<{ ok: boolean }>>[0]> = {}) =>
    callClaudeJson({
      callSite: "popupRedacteur",
      model: "claude-sonnet-5-5",
      system: "sys",
      user: "usr",
      maxTokens: 1000,
      effort: "medium",
      schema: Schema,
      timeoutMs: 45_000,
      attempt: 1,
      deps: { create, record, spend, now: () => 0 },
      ...extra,
    });
  return { call, record };
}

describe("callClaudeJson", () => {
  it("ok : parse, coût, tokens, journal complet, requête sans temperature", async () => {
    const create = vi.fn<CreateFn>(async () => response());
    const { call, record } = setup(create);
    const r = await call();
    expect(r.status).toBe("ok");
    expect(r.data).toEqual({ ok: true });
    expect(r.model).toBe("claude-sonnet-5-5");
    expect(r.usage).toEqual({ input: 1000, output: 500, thinking: 120, cacheRead: 0, cacheWrite: 0 });
    expect(r.costUsd).toBeCloseTo((1000 * 2 + 500 * 10) / 1e6, 10);
    expect(r.retriable).toBe(false);

    const [params, options] = create.mock.calls[0];
    expect(params).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: 1000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("top_p");
    expect(params).not.toHaveProperty("top_k");
    expect(options).toEqual({ timeout: 45_000 });

    expect(record).toHaveBeenCalledTimes(1);
    const [site, model, usage, meta] = record.mock.calls[0];
    expect(site).toBe("popupRedacteur");
    expect(model).toBe("claude-sonnet-5-5");
    expect(usage).toMatchObject({ input_tokens: 1000, output_tokens: 500 });
    expect(meta).toMatchObject({
      status: "ok",
      stopReason: "end_turn",
      requestId: "req_1",
      thinkingTokens: 120,
      attempt: 1,
    });
  });

  it("tolère la clôture de code et concatène les blocs text (thinking ignoré)", async () => {
    const create = vi.fn<CreateFn>(async () =>
      response({
        content: [
          { type: "thinking" },
          { type: "text", text: '```json\n{"ok":' },
          { type: "text", text: "true}\n```" },
        ],
      }),
    );
    const r = await setup(create).call();
    expect(r.status).toBe("ok");
    expect(r.data).toEqual({ ok: true });
  });

  it("refus : statut, stop_details, relançable seulement pour le rédacteur", async () => {
    const create: CreateFn = async () =>
      response({ stop_reason: "refusal", stop_details: { category: "cyber", explanation: "non" }, content: [] });
    const red = await setup(create).call();
    expect(red).toMatchObject({ status: "refusal", retriable: true, refusal: { category: "cyber", explanation: "non" } });
    const cls = await setup(create).call({ callSite: "popupClassifier" });
    expect(cls).toMatchObject({ status: "refusal", retriable: false });
  });

  it("max_tokens et fenêtre de contexte", async () => {
    for (const stop of ["max_tokens", "model_context_window_exceeded"]) {
      const r = await setup(async () => response({ stop_reason: stop, content: [{ type: "text", text: '{"ok' }] })).call();
      expect(r).toMatchObject({ status: "max_tokens", retriable: true });
    }
  });

  it("autre stop_reason : invalid_output", async () => {
    const r = await setup(async () => response({ stop_reason: "pause_turn" })).call();
    expect(r.status).toBe("invalid_output");
    expect(r.issues?.[0]).toContain("pause_turn");
  });

  it("JSON tronqué et schéma non respecté : invalid_output avec issues, journalisé", async () => {
    const trunc = setup(async () => response({ content: [{ type: "text", text: '{"ok": tr' }] }));
    const r1 = await trunc.call();
    expect(r1).toMatchObject({ status: "invalid_output", retriable: true });
    expect(r1.rawText).toBe('{"ok": tr');
    expect(trunc.record.mock.calls[0][3]).toMatchObject({ status: "invalid_output" });

    const bad = await setup(async () => response({ content: [{ type: "text", text: '{"ok":"oui"}' }] })).call();
    expect(bad.status).toBe("invalid_output");
    expect(bad.issues?.[0]).toContain("ok");
  });

  it("timeout : statut, relançable, coût estimé au pire journalisé", async () => {
    const { call, record } = setup(async () => {
      throw new Anthropic.APIConnectionTimeoutError();
    });
    const r = await call();
    expect(r).toMatchObject({ status: "timeout", retriable: true });
    // 6 caractères d'entrée -> 2 tokens ; + 1000 tokens de sortie au tarif sortie.
    expect(r.costUsd).toBeCloseTo((2 * 2 + 1000 * 10) / 1e6, 10);
    expect(record.mock.calls[0][3]).toMatchObject({ status: "timeout", estimatedCostUsd: r.costUsd });
  });

  it("api_error : retriable selon le statut HTTP, retry-after lu", async () => {
    const mk = (status: number, headers?: Record<string, string>) =>
      setup(async () => {
        throw new Anthropic.APIError(status, { message: "x" }, "x", new Headers(headers));
      }).call();
    for (const s of [408, 409, 429, 500, 503, 529]) {
      expect(await mk(s)).toMatchObject({ status: "api_error", httpStatus: s, retriable: true, costUsd: 0 });
    }
    for (const s of [400, 401, 403, 404, 413]) {
      expect(await mk(s)).toMatchObject({ status: "api_error", httpStatus: s, retriable: false });
    }
    const limited = await mk(429, { "retry-after": "7" });
    expect(limited.retryAfterMs).toBe(7000);
  });

  it("erreur réseau sans statut : api_error relançable", async () => {
    const r = await setup(async () => {
      throw new Error("ECONNRESET");
    }).call();
    expect(r).toMatchObject({ status: "api_error", retriable: true });
    expect(r.errorMessage).toBe("ECONNRESET");
  });

  it("clé absente : api_error non relançable, aucun appel ni journal", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const record = vi.fn<RecordFn>(async () => true);
      const r = await callClaudeJson({
        callSite: "popupClassifier",
        model: "claude-sonnet-5-5",
        system: "s",
        user: "u",
        maxTokens: 100,
        effort: "low",
        schema: Schema,
        timeoutMs: 1000,
        attempt: 1,
        deps: { spend: async () => 0, record, now: () => 0 },
      });
      expect(r).toMatchObject({ status: "api_error", retriable: false });
      expect(record).not.toHaveBeenCalled();
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

describe("plafond popup", () => {
  it("cap_reached sans appel ni ligne de journal quand dépense + pire coût > 1 $", async () => {
    const create = vi.fn<CreateFn>(async () => response());
    const { call, record } = setup(create, { spend: 0.999 });
    const r = await call();
    expect(r).toMatchObject({ status: "cap_reached", retriable: false, costUsd: 0 });
    expect(create).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("passe sous le plafond", async () => {
    const { call } = setup(async () => response(), { spend: 0.5 });
    expect((await call()).status).toBe("ok");
  });

  it("échoue fermé : lecture en erreur (Infinity ou exception)", async () => {
    for (const spend of [async () => Number.POSITIVE_INFINITY, async () => Promise.reject(new Error("db"))]) {
      const create = vi.fn<CreateFn>(async () => response());
      const r = await setup(create, { spend }).call();
      expect(r.status).toBe("cap_reached");
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("compte d'avance le pire coût d'un paquet d'appels parallèles", async () => {
    // pire coût unitaire ~ 0,01 $ ; 6 appels = 0,06 $.
    const create = vi.fn<CreateFn>(async () => response());
    const { call } = setup(create, { spend: 0.95 });
    expect((await call()).status).toBe("ok");
    expect((await call({ parallelCalls: 6 })).status).toBe("cap_reached");
  });

  it("cumule le coût en mémoire même si le journal relit 0", async () => {
    const budget = createRunBudget();
    budget.spentUsd = 0.995;
    const create = vi.fn<CreateFn>(async () => response());
    const r = await setup(create, { spend: 0 }).call({ budget });
    expect(r.status).toBe("cap_reached");
    expect(create).not.toHaveBeenCalled();
  });

  it("un record qui lève ne fait pas lever l'appel et ferme le plafond", async () => {
    const budget = createRunBudget();
    const { call } = setup(async () => response(), {
      record: async () => {
        throw new Error("db");
      },
    });
    expect((await call({ budget })).status).toBe("ok");
    expect(budget.journalFailed).toBe(true);
  });

  it("un échec d'écriture du journal ferme le plafond pour la suite du run", async () => {
    const budget = createRunBudget();
    const create = vi.fn<CreateFn>(async () => response());
    const { call } = setup(create, { record: async () => false, spend: 0 });
    expect((await call({ budget })).status).toBe("ok");
    expect(budget.journalFailed).toBe(true);
    expect(budget.spentUsd).toBeGreaterThan(0);
    expect((await call({ budget })).status).toBe("cap_reached");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
