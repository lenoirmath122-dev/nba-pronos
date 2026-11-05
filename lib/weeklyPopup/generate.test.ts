import { describe, expect, it, vi } from "vitest";
import type { LlmCallResult } from "@/lib/ai/claudeJson";
import { runWeeklyPopupGeneration, type GenerateDeps } from "./generate";
import { U1, U2, bet, user, usersMap } from "./testFixtures";
import { fakeClient, type Call } from "./testSupabase";
import type { PopupBetRow, WeekData, WeeklyPopupCandidate, WeeklyPopupRow } from "./types";

const NOW = 1_800_000_000_000;
const DEADLINE = NOW + 270_000;
const POPUP_ID = "popup-1";
const GEN_ID = "gen-1";

const PSEUDOS = { [U1]: "Pseudo-Secret-Nico", [U2]: "Pseudo-Secret-Alix" };

function row(overrides: Partial<WeeklyPopupRow> = {}): WeeklyPopupRow {
  return {
    id: POPUP_ID,
    competition_id: "comp",
    week_end_date: "2026-10-26",
    kind: "LLM",
    status: "GENERATING",
    doubt_code: null,
    doubt_detail: null,
    generation_id: GEN_ID,
    generation_started_at: new Date(NOW).toISOString(),
    generation_count: 0,
    prompt_version: null,
    candidates: [],
    generated_content: { titre: "ancien", champion: null, top: null, flop: null, refuse: null, cta: "ancien" },
    raw_output: null,
    content: { titre: "ancien", champion: null, top: null, flop: null, refuse: null, cta: "ancien" },
    warnings: [],
    attempts: [],
    featured_user_ids: [],
    admin_notified_at: null,
    published_at: null,
    published_by: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function week(overrides: Partial<WeekData> = {}, bets?: PopupBetRow[]): WeekData {
  const list = bets ?? [
    bet({ user_id: U1, status: "WON", description: "Brunson plus de 30", resolution_reason: "41 points." }),
    bet({ user_id: U2 }),
    bet({
      user_id: U1,
      status: "REJECTED",
      resolved_at: null,
      rejected_at: "2026-10-21T09:00:00Z",
      calculated_proba: null,
      resolution_reason: null,
      description: "pari absurde",
    }),
  ];
  return {
    competitionId: "comp",
    weekEnd: "2026-10-26",
    startIso: "2026-10-19T08:00:00Z",
    endIso: "2026-10-26T09:00:00Z",
    rawCount: list.length,
    bets: list,
    users: usersMap(user(U1, PSEUDOS[U1]), user(U2, PSEUDOS[U2])),
    matchLabels: new Map([["match-1", "BOS - NYK"]]),
    champions: [],
    recentlyFeaturedIds: new Set(),
    recentPhrasing: { titres: [], cta: [] },
    publishedFallbackCount: 0,
    truncated: false,
    ...overrides,
  };
}

function llm<T>(status: LlmCallResult<T>["status"], extra: Partial<LlmCallResult<T>> = {}): LlmCallResult<T> {
  return {
    status,
    latencyMs: 100,
    attempt: 1,
    costUsd: 0.01,
    retriable: false,
    usage: { input: 10, output: 20, thinking: 0, cacheRead: 0, cacheWrite: 0 },
    ...extra,
  };
}

const idsOf = (user: string): string[] =>
  user
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l).id as string);

const okClassifier = (opts: { user: string }) =>
  llm("ok", { data: { verdicts: idsOf(opts.user).map((id) => ({ id, verdict: "ok" as const, categorie: null })) } });

const okRedacteur = (withFlop = true) =>
  llm("ok", {
    data: {
      titre: "Semaine folle",
      champion: null,
      top: `@${PSEUDOS[U1]} a vu juste.`,
      flop: withFlop ? `@${PSEUDOS[U2]} a raté de peu.` : null,
      refuse: "Un pari absurde.",
      cta: "Reviens vite.",
      paris_cites: { top: ["t1"], flop: withFlop ? ["f1"] : [], refuse: ["r1"] },
    },
  });

type CallOpts = { callSite: string; user: string; timeoutMs: number; parallelCalls?: number; budget?: unknown; attempt: number };

function setup(
  options: {
    row?: WeeklyPopupRow | null;
    week?: WeekData | (() => WeekData);
    call?: (opts: CallOpts) => LlmCallResult<unknown>;
    finalMatches?: boolean;
    trigger?: "CRON" | "ADMIN_FREEZE" | "ADMIN_GENERATE";
    load?: GenerateDeps["load"];
    deadlineMs?: number;
    preview?: { competitionId: string; weekEnd: string };
  } = {},
) {
  const current = options.row === undefined ? row() : options.row;
  const writes: Call[] = [];
  const { client, calls } = fakeClient((call) => {
    if (call.table === "weekly_popups" && call.op === "select") return { data: current };
    if (call.table === "weekly_popups" && call.op === "update") {
      writes.push(call);
      return { data: options.finalMatches === false ? null : { id: POPUP_ID } };
    }
    return { data: null };
  });
  const call = vi.fn(async (opts: CallOpts) => (options.call ?? defaultCall)(opts));
  const notify = vi.fn().mockResolvedValue({ sent: true });
  const load = options.load ?? vi.fn(async () => (typeof options.week === "function" ? options.week() : (options.week ?? week())));
  const deps: GenerateDeps = {
    client,
    call: call as never,
    load: load as never,
    notify: notify as never,
    now: () => NOW,
    sleep: async () => {},
  };
  const run = () =>
    runWeeklyPopupGeneration(POPUP_ID, GEN_ID, {
      deadlineMs: options.deadlineMs ?? DEADLINE,
      trigger: options.trigger ?? "CRON",
      deps,
      preview: options.preview,
    });
  return { run, call, notify, writes, load, calls };
}

function defaultCall(opts: CallOpts): LlmCallResult<unknown> {
  return opts.callSite === "popupClassifier" ? okClassifier(opts) : okRedacteur();
}

const lastWrite = (writes: Call[]) => writes[writes.length - 1].payload as Record<string, unknown>;

describe("génération nominale", () => {
  it("classifieur puis rédacteur : READY, contenu tokenisé, notification admin", async () => {
    const { run, call, notify, writes } = setup();
    const outcome = await run();
    expect(outcome).toMatchObject({ written: true, status: "READY", kind: "LLM", notified: true });
    expect(call).toHaveBeenCalledTimes(2);
    const payload = lastWrite(writes);
    expect(payload.status).toBe("READY");
    expect(payload.kind).toBe("LLM");
    const content = payload.content as { top: string; flop: string };
    expect(content.top).toBe(`{{u:${U1}}} a vu juste.`);
    expect(content.flop).toBe(`{{u:${U2}}} a raté de peu.`);
    expect(payload.generated_content).toEqual(payload.content);
    expect(payload.prompt_version).toBe("redacteur-v6.1/classifieur-v1");
    expect(payload.generation_count).toBe(1);
    expect(payload.raw_output).toBeNull();
    expect(notify).toHaveBeenCalledWith(POPUP_ID, expect.objectContaining({ status: "READY" }), expect.anything());
  });

  it("écriture gardée par generation_id et statut GENERATING", async () => {
    const { run, writes } = setup();
    await run();
    expect(writes[0].filters).toEqual(
      expect.arrayContaining([
        ["eq", "id", POPUP_ID],
        ["eq", "generation_id", GEN_ID],
        ["eq", "status", "GENERATING"],
      ]),
    );
  });

  it("timeouts bornés par ce qu'il reste avant l'échéance (jamais < 5 s)", async () => {
    const wide = setup();
    await wide.run();
    // 270 s de marge : le timeout du rôle (25 s, 45 s) s'applique.
    expect(wide.call.mock.calls.map(([o]) => o.timeoutMs)).toEqual([25_000, 45_000]);

    // 40 s restantes, 10 s réservées pour finir : 30 s au plus par appel.
    const tight = setup({ deadlineMs: NOW + 40_000 });
    await tight.run();
    expect(tight.call.mock.calls.map(([o]) => o.timeoutMs)).toEqual([25_000, 30_000]);
  });

  it("un verdict identique est réutilisé : aucun appel au classifieur", async () => {
    const w = week();
    const previous: WeeklyPopupCandidate[] = [];
    // Premier passage pour récupérer les candidats et leurs hashes.
    const first = setup({ week: w });
    await first.run();
    const stored = lastWrite(first.writes).candidates as WeeklyPopupCandidate[];
    previous.push(...stored);
    expect(stored.every((c) => c.verdict === "ok")).toBe(true);

    const second = setup({ week: w, row: row({ candidates: previous }) });
    await second.run();
    expect(second.call).toHaveBeenCalledTimes(1);
    expect(second.call.mock.calls[0][0].callSite).toBe("popupRedacteur");
  });
});

describe("semaine pauvre", () => {
  it("niveau 1 : aucun appel, FALLBACK en READY", async () => {
    const { run, call, writes } = setup({ week: week({ rawCount: 2, bets: [] }) });
    const outcome = await run();
    expect(call).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: "READY", kind: "FALLBACK" });
    const content = lastWrite(writes).content as { titre: string; repli: string };
    expect(content.titre).toBe("Semaine calme au comptoir");
    expect(content.repli).toBeTruthy();
  });

  it("niveau 1 avec champion : avertissement champion_non_classe", async () => {
    const w = week({ rawCount: 1, bets: [], champions: [{ userId: U1, points: 10 }] });
    const { run, writes } = setup({ week: w });
    await run();
    const warnings = lastWrite(writes).warnings as { code: string }[];
    expect(warnings.map((x) => x.code)).toContain("champion_non_classe");
  });

  it("niveau 2 : tout bloqué, FALLBACK après le classifieur, pas de rédacteur", async () => {
    const { run, call, writes } = setup({
      call: (opts) =>
        llm("ok", {
          data: { verdicts: idsOf(opts.user).map((id) => ({ id, verdict: "bloque" as const, categorie: "doute" as const })) },
        }),
    });
    const outcome = await run();
    expect(call).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: "READY", kind: "FALLBACK" });
    expect(lastWrite(writes).kind).toBe("FALLBACK");
  });
});

describe("classifieur", () => {
  it("lot refusé : repli unitaire par paquets de 6, même budget, refus non relancé", async () => {
    const budgets = new Set<unknown>();
    const parallels: (number | undefined)[] = [];
    const { run, call } = setup({
      call: (opts) => {
        if (opts.callSite === "popupRedacteur") return okRedacteur(false);
        budgets.add(opts.budget);
        parallels.push(opts.parallelCalls);
        const ids = idsOf(opts.user);
        if (ids.length > 1) return llm("refusal", { retriable: false });
        if (ids[0] === "f1") return llm("refusal", { retriable: false });
        return llm("ok", { data: { verdicts: [{ id: ids[0], verdict: "ok" as const, categorie: null }] } });
      },
    });
    const outcome = await run();
    const classifierCalls = call.mock.calls.filter(([o]) => o.callSite === "popupClassifier");
    // 1 lot + 3 appels unitaires, aucun relancé malgré le refus.
    expect(classifierCalls).toHaveLength(4);
    expect(budgets.size).toBe(1);
    expect(parallels.slice(1)).toEqual([3, 3, 3]);
    expect(outcome.status).toBe("READY");
  });

  it("refus unitaire : candidat bloqué (doute), joueur retiré", async () => {
    const { run, writes } = setup({
      call: (opts) => {
        if (opts.callSite === "popupRedacteur") return okRedacteur(false);
        const ids = idsOf(opts.user);
        if (ids.length > 1) return llm("refusal");
        if (ids[0] === "f1") return llm("refusal");
        return llm("ok", { data: { verdicts: [{ id: ids[0], verdict: "ok" as const, categorie: null }] } });
      },
    });
    await run();
    const cands = lastWrite(writes).candidates as WeeklyPopupCandidate[];
    const f1 = cands.find((c) => c.short_id === "f1")!;
    expect(f1).toMatchObject({ verdict: "bloque", categorie: "doute", verdict_source: "unitaire" });
  });

  it("plafond atteint en plein repli unitaire : les verdicts déjà payés sont conservés", async () => {
    const { run, writes } = setup({
      call: (opts) => {
        const ids = idsOf(opts.user);
        if (ids.length > 1) return llm("refusal");
        if (ids[0] === "f1") return llm("cap_reached");
        return llm("ok", { data: { verdicts: [{ id: ids[0], verdict: "ok" as const, categorie: null }] } });
      },
    });
    const outcome = await run();
    expect(outcome).toMatchObject({ status: "DOUBTFUL", doubtCode: "cap_reached" });
    const cands = lastWrite(writes).candidates as WeeklyPopupCandidate[];
    expect(cands.find((c) => c.short_id === "t1")?.verdict).toBe("ok");
    expect(cands.find((c) => c.short_id === "f1")?.verdict).toBeUndefined();
  });

  it("lot invalide 3 fois : DOUBTFUL invalid_output, contenu précédent conservé", async () => {
    const { run, call, writes } = setup({
      call: () => llm("invalid_output", { retriable: true, rawText: "pas du json" }),
    });
    const outcome = await run();
    expect(call).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({ status: "DOUBTFUL", doubtCode: "invalid_output" });
    const payload = lastWrite(writes);
    expect(payload.status).toBe("DOUBTFUL");
    expect(payload).not.toHaveProperty("content");
    expect(payload).not.toHaveProperty("generated_content");
  });

  it("plafond atteint : non relancé, DOUBTFUL cap_reached", async () => {
    const { run, call } = setup({ call: () => llm("cap_reached", { retriable: false }) });
    const outcome = await run();
    expect(call).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: "DOUBTFUL", doubtCode: "cap_reached" });
  });
});

describe("rédacteur", () => {
  it("un refus est relancé", async () => {
    let redacteurCalls = 0;
    const { run } = setup({
      call: (opts) => {
        if (opts.callSite === "popupClassifier") return okClassifier(opts);
        redacteurCalls += 1;
        return redacteurCalls === 1 ? llm("refusal", { retriable: true }) : okRedacteur();
      },
    });
    const outcome = await run();
    expect(redacteurCalls).toBe(2);
    expect(outcome.status).toBe("READY");
  });

  it("structure invalide 3 fois : DOUBTFUL structure, sortie brute gardée, détail en codes", async () => {
    const bad = llm("ok", {
      rawText: '{"titre":"x"}',
      data: {
        titre: "Semaine folle",
        champion: null,
        top: `@${PSEUDOS[U1]} a vu juste.`,
        flop: "@Intrus a raté.",
        refuse: "Un pari absurde.",
        cta: "Reviens vite.",
        paris_cites: { top: ["t1"], flop: ["f1"], refuse: ["r1"] },
      },
    });
    const { run, call, writes } = setup({
      call: (opts) => (opts.callSite === "popupClassifier" ? okClassifier(opts) : bad),
    });
    const outcome = await run();
    expect(call).toHaveBeenCalledTimes(1 + 3);
    expect(outcome).toMatchObject({ status: "DOUBTFUL", doubtCode: "structure" });
    const payload = lastWrite(writes);
    expect(payload.raw_output).toBe('{"titre":"x"}');
    expect(payload.doubt_detail).toContain("mention_hors_ensemble:flop");
    expect(String(payload.doubt_detail)).not.toContain("Intrus");
  });

  it("échéance trop proche : DOUBTFUL budget, aucun appel", async () => {
    const { client } = fakeClient((call) =>
      call.op === "select" ? { data: row() } : { data: { id: POPUP_ID } },
    );
    const callFn = vi.fn();
    const outcome = await runWeeklyPopupGeneration(POPUP_ID, GEN_ID, {
      deadlineMs: NOW + 5_000,
      trigger: "ADMIN_GENERATE",
      deps: {
        client,
        call: callFn as never,
        load: (async () => week()) as never,
        notify: vi.fn() as never,
        now: () => NOW,
        sleep: async () => {},
      },
    });
    expect(callFn).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: "DOUBTFUL", doubtCode: "budget" });
  });
});

describe("garde-fous", () => {
  it("écriture finale à 0 ligne (autre génération gagnante) : pas de notification", async () => {
    const { run, notify } = setup({ finalMatches: false });
    const outcome = await run();
    expect(outcome.written).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it("ligne non GENERATING ou generation_id différent : abandonnée, aucun appel", async () => {
    for (const r of [row({ status: "READY" }), row({ generation_id: "autre" }), null]) {
      const { run, call, writes } = setup({ row: r });
      const outcome = await run();
      expect(outcome.status).toBe("abandoned");
      expect(call).not.toHaveBeenCalled();
      expect(writes).toHaveLength(0);
    }
  });

  it("exception imprévue : DOUBTFUL internal, jamais err.message", async () => {
    const { run, writes } = setup({
      load: (async () => {
        throw new Error("secret Pseudo-Secret-Nico");
      }) as never,
    });
    const outcome = await run();
    expect(outcome).toMatchObject({ status: "DOUBTFUL", doubtCode: "internal" });
    const payload = lastWrite(writes);
    expect(payload.doubt_detail).toBe("exception:Error");
    expect(JSON.stringify(payload)).not.toContain("Pseudo-Secret");
  });

  it("notification seulement pour le déclenchement cron", async () => {
    const { run, notify } = setup({ trigger: "ADMIN_FREEZE" });
    const outcome = await run();
    expect(outcome.written).toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });

  it("attempts limité à 20, anciens historiques conservés", async () => {
    const old = Array.from({ length: 25 }, (_, i) => ({
      role: "redacteur" as const,
      attempt: 1,
      status: "ok" as const,
      latency_ms: i,
      cost_usd: 0,
      at: "",
    }));
    const { run, writes } = setup({ row: row({ attempts: old }) });
    await run();
    const attempts = lastWrite(writes).attempts as { latency_ms: number }[];
    expect(attempts).toHaveLength(20);
    expect(attempts[attempts.length - 1].latency_ms).toBe(100);
  });

  it("RGPD : warnings, attempts et doubt_detail sans pseudo ni texte de pari", async () => {
    const { run, writes } = setup({
      week: week(
        {},
        [
          bet({ user_id: U1, status: "WON", description: "Texte-Secret-Top", resolution_reason: "ok" }),
          bet({ user_id: U2, description: "Texte-Secret-Flop @Intrus" }),
          bet({ user_id: U1, description: "Texte-Secret-Flop2", resolution_reason: "x" }),
        ],
      ),
      call: (opts) => (opts.callSite === "popupClassifier" ? okClassifier(opts) : llm("timeout", { retriable: true, errorMessage: "Texte-Secret-Top" })),
    });
    await run();
    const payload = lastWrite(writes);
    const dump = JSON.stringify([payload.warnings, payload.attempts, payload.doubt_detail]);
    expect(dump).not.toMatch(/Pseudo-Secret|Texte-Secret/);
  });

  it("candidates stockés sans pseudo", async () => {
    const { run, writes } = setup();
    await run();
    expect(JSON.stringify(lastWrite(writes).candidates)).not.toContain("Pseudo-Secret");
  });
});


describe("essai (preview, décision 13)", () => {
  const preview = { competitionId: "comp", weekEnd: "2026-10-26" };

  it("ne lit ni n'écrit weekly_popups, ne notifie pas, renvoie ce qui aurait été écrit", async () => {
    const { run, call, notify, calls } = setup({ preview, row: null, trigger: "ADMIN_GENERATE" });
    const outcome = await run();
    expect(outcome).toMatchObject({ written: true, status: "READY", kind: "LLM", notified: false });
    expect(outcome.preview?.content?.top).toBe(`{{u:${U1}}} a vu juste.`);
    expect(outcome.preview?.candidates.length).toBeGreaterThan(0);
    expect(call).toHaveBeenCalledTimes(2);
    expect(calls.filter((c) => c.table === "weekly_popups")).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("lit la semaine demandée, pas celle d'une ligne", async () => {
    const { run, load } = setup({ preview, row: null, trigger: "ADMIN_GENERATE" });
    await run();
    expect(load).toHaveBeenCalledWith("comp", "2026-10-26", expect.anything());
  });

  it("échec du modèle : DOUBTFUL avec le motif, toujours sans écriture", async () => {
    const { run, calls } = setup({
      preview,
      row: null,
      trigger: "ADMIN_GENERATE",
      call: (opts) => (opts.callSite === "popupClassifier" ? okClassifier(opts) : llm("api_error", { retriable: false })),
    });
    const outcome = await run();
    expect(outcome.status).toBe("DOUBTFUL");
    expect(outcome.doubtCode).toBe("api_error");
    expect(outcome.preview?.content).toBeNull();
    expect(outcome.preview?.doubtDetail).toContain("api_error");
    expect(calls.filter((c) => c.table === "weekly_popups")).toHaveLength(0);
  });
});
