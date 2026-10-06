import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DAILY_MATCH_CRON_START,
  cronDrawDays,
  daysBetween,
  daySeed,
  filterCandidates,
  makeRng,
  pickCandidate,
  runDailyDraw,
  validateManualRange,
  validateRange,
  type DrawApiMatch,
  type DrawDeps,
  type DrawMatch,
} from "./draw";

const teams = new Map([
  ["1", "t-bos"],
  ["2", "t-nyk"],
  ["3", "t-lal"],
  ["4", "t-gsw"],
]);
const isScheduled = (d: string) => d === "Scheduled";

// 2026-10-21T00:00Z = 20/10 20h à New York (EDT) : bien le jour NY 2026-10-20.
function m(id: number, home: string, away: string, date = "2026-10-21T00:00:00.000Z", status = "Scheduled"): DrawMatch {
  return { id, date, statusDescription: status, homeRef: home, awayRef: away };
}
const ctx = (over = {}) => ({ day: "2026-10-20", teamIdByRef: teams, mappedMatchRefs: new Set<string>(), isScheduled, ...over });

describe("makeRng / daySeed", () => {
  it("même graine -> même suite", () => {
    const a = makeRng("abc");
    const b = makeRng("abc");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("graines différentes -> suites différentes", () => {
    expect(makeRng("abc")()).not.toBe(makeRng("abd")());
  });
  it("la graine d'un jour dépend du jour", () => {
    expect(daySeed("run", "2026-10-20")).toBe(daySeed("run", "2026-10-20"));
    expect(daySeed("run", "2026-10-20")).not.toBe(daySeed("run", "2026-10-21"));
  });
});

describe("filterCandidates", () => {
  it("garde un match valide du bon jour NY", () => {
    expect(filterCandidates([m(10, "1", "2")], ctx()).map((c) => c.id)).toEqual([10]);
  });
  it("écarte équipe non mappée, statut non SCHEDULED, id déjà mappé, mauvais jour", () => {
    const raw = [
      m(1, "1", "99"),
      m(2, "1", "2", undefined, "Finished"),
      m(3, "1", "2"),
      m(4, "3", "4", "2026-10-22T00:00:00.000Z"),
      m(5, "3", "4"),
    ];
    const out = filterCandidates(raw, ctx({ mappedMatchRefs: new Set(["3"]) }));
    expect(out.map((c) => c.id)).toEqual([5]);
  });
  it("trie par id croissant quel que soit l'ordre de l'API et dédoublonne", () => {
    const out = filterCandidates([m(30, "1", "2"), m(10, "3", "4"), m(30, "1", "2")], ctx());
    expect(out.map((c) => c.id)).toEqual([10, 30]);
  });
});

describe("pickCandidate", () => {
  const cands = filterCandidates([m(1, "1", "2"), m(2, "3", "4"), m(3, "1", "3")], ctx());
  it("jour vide -> null", () => expect(pickCandidate([], "s")).toBeNull());
  it("reproductible avec la même graine", () => {
    expect(pickCandidate(cands, "seed")).toEqual(pickCandidate(cands, "seed"));
  });
  it("l'index est toujours dans les bornes", () => {
    for (let i = 0; i < 200; i++) {
      const p = pickCandidate(cands, `s${i}`)!;
      expect(p.index).toBeGreaterThanOrEqual(0);
      expect(p.index).toBeLessThan(cands.length);
    }
  });
});

describe("validateRange", () => {
  const none = () => false;
  it("lot valide", () => expect(validateRange("2026-10-20", "2026-10-29", none)).toEqual([]));
  it("11 jours -> refusé", () => expect(validateRange("2026-10-20", "2026-10-30", none)).toHaveLength(1));
  it("avant le premier jour -> refusé", () => expect(validateRange("2026-10-19", "2026-10-21", none).length).toBeGreaterThan(0));
  it("après le dernier jour -> refusé", () => expect(validateRange("2026-11-26", "2026-11-28", none).length).toBeGreaterThan(0));
  it("from > to -> refusé", () => expect(validateRange("2026-10-25", "2026-10-21", none).length).toBeGreaterThan(0));
  it("jour déjà publié -> refusé", () => {
    expect(validateRange("2026-10-20", "2026-10-22", (d) => d === "2026-10-21")[0]).toContain("2026-10-21");
  });
  it("daysBetween traverse la bascule de mois", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("cronDrawDays", () => {
  const none = () => false;
  it("rien avant le début du cron (18/10)", () => {
    expect(DAILY_MATCH_CRON_START).toBe("2026-10-18");
    expect(cronDrawDays("2026-10-17", none)).toEqual([]);
  });
  it("le 18/10 ne tire que les jours >= premier jour", () => {
    expect(cronDrawDays("2026-10-18", none)).toEqual(["2026-10-20"]);
    expect(cronDrawDays("2026-10-19", none)).toEqual(["2026-10-20", "2026-10-21"]);
  });
  it("fenêtre de 3 jours en régime normal", () => {
    expect(cronDrawDays("2026-10-20", none)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
  });
  it("borné au dernier jour, rien après", () => {
    expect(cronDrawDays("2026-11-26", none)).toEqual(["2026-11-26", "2026-11-27"]);
    expect(cronDrawDays("2026-11-28", none)).toEqual([]);
  });
  it("retire les jours déjà publiés", () => {
    expect(cronDrawDays("2026-10-21", (d) => d === "2026-10-21")).toEqual(["2026-10-22", "2026-10-23"]);
  });
});

describe("validateManualRange", () => {
  const none = () => false;
  it("sans override : mêmes règles que validateRange", () => {
    expect(validateManualRange("2026-10-07", "2026-10-07", { override: false, isPublished: none }).length).toBeGreaterThan(0);
  });
  it("avec override : avant le premier jour et jour publié acceptés", () => {
    expect(validateManualRange("2026-10-07", "2026-10-07", { override: true, isPublished: () => true })).toEqual([]);
  });
  it("avec override : format, ordre et taille restent contrôlés", () => {
    expect(validateManualRange("x", "2026-10-07", { override: true, isPublished: none })).toHaveLength(1);
    expect(validateManualRange("2026-10-08", "2026-10-07", { override: true, isPublished: none })).toHaveLength(1);
    expect(validateManualRange("2026-10-01", "2026-10-20", { override: true, isPublished: none })).toHaveLength(1);
  });
});

// --- runDailyDraw avec un faux Supabase chaînable (fakes injectés, pas de vi.mock).
type FakeQuery = { table: string; op: string; filters: [string, unknown][]; payload: unknown };
type FakeState = {
  competition: { id: string; name: string; type: string } | null;
  series: { id: string; slot_index: number }[];
  matchCountBySeries: Record<string, number>;
  mappingError: string | null;
  writes: string[];
  audit: Record<string, unknown>[];
};

function fakeSupabase(state: FakeState): SupabaseClient {
  const run = (q: FakeQuery, one: boolean) => {
    if (q.op !== "select") state.writes.push(`${q.op}:${q.table}`);
    if (q.op === "insert" && q.table === "audit_logs") state.audit.push(q.payload as Record<string, unknown>);
    if (q.op === "insert" && q.table === "entity_mappings" && state.mappingError) {
      return { data: null, error: { message: state.mappingError } };
    }
    if (q.op === "insert" && q.table === "series") return { data: { id: "s-new" }, error: null };
    if (q.op === "insert" && q.table === "matches") return { data: { id: "m-new" }, error: null };
    if (q.op !== "select") return { data: null, error: null };
    if (q.table === "competitions") return { data: one ? state.competition : [state.competition], error: null };
    if (q.table === "entity_mappings") {
      const type = q.filters.find(([k]) => k === "entity_type")?.[1];
      const teams = [
        { internal_id: "t-bos", source_ref: "1" },
        { internal_id: "t-nyk", source_ref: "2" },
      ];
      return { data: type === "TEAM" ? teams : [], error: null };
    }
    if (q.table === "series") return { data: state.series, error: null };
    if (q.table === "matches") {
      const sid = String(q.filters.find(([k]) => k === "series_id")?.[1]);
      return { data: null, count: state.matchCountBySeries[sid] ?? 0, error: null };
    }
    return { data: null, error: null };
  };
  return {
    from(table: string) {
      const q: FakeQuery = { table, op: "select", filters: [], payload: null };
      const b = {
        select: () => b,
        eq: (k: string, v: unknown) => {
          q.filters.push([k, v]);
          return b;
        },
        insert: (p: unknown) => {
          q.op = "insert";
          q.payload = p;
          return b;
        },
        update: (p: unknown) => {
          q.op = "update";
          q.payload = p;
          return b;
        },
        delete: () => {
          q.op = "delete";
          return b;
        },
        maybeSingle: () => Promise.resolve(run(q, true)),
        single: () => Promise.resolve(run(q, true)),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run(q, false)).then(res, rej),
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

const apiMatch = (id: number): DrawApiMatch => ({
  id,
  date: "2026-10-21T00:00:00.000Z",
  state: { description: "Scheduled" },
  homeTeam: { id: 1 },
  awayTeam: { id: 2 },
});

function setup(over: Partial<FakeState> = {}, fetched: { calls: string[]; remaining: number | null } = { calls: [], remaining: 500 }) {
  const state: FakeState = {
    competition: { id: "c1", name: "Daily", type: "DAILY_MATCH" },
    series: [],
    matchCountBySeries: {},
    mappingError: null,
    writes: [],
    audit: [],
    ...over,
  };
  const deps: DrawDeps = {
    supabase: fakeSupabase(state),
    fetchDay: async (day) => {
      fetched.calls.push(day);
      return { data: [apiMatch(10)], requestsRemaining: fetched.remaining };
    },
    isScheduled,
    toSlot: (d) => Number(d.replaceAll("-", "")),
    publishAt: (d) => `${d}T08:00:00.000Z`,
    log: () => {},
  };
  return { state, deps, fetched };
}
const opts = (over = {}) => ({ days: ["2026-10-20"], dryRun: false, runSeed: "seed", minRemaining: 20, source: "cron" as const, ...over });

describe("runDailyDraw", () => {
  it("tire un jour : série, match, mapping, audit (source reportée)", async () => {
    const { state, deps } = setup();
    const r = await runDailyDraw(deps, opts({ source: "manual" }));
    expect(r.drawn).toEqual(["2026-10-20"]);
    expect(state.writes).toEqual(["insert:series", "insert:matches", "insert:entity_mappings", "insert:audit_logs"]);
    expect((state.audit[0].after_value as { source: string }).source).toBe("manual");
  });
  it("jour déjà tiré : sauté, aucun appel API", async () => {
    const { state, deps, fetched } = setup({ series: [{ id: "s1", slot_index: 20261020 }], matchCountBySeries: { s1: 1 } });
    const r = await runDailyDraw(deps, opts());
    expect(r.skipped).toEqual(["2026-10-20"]);
    expect(fetched.calls).toEqual([]);
    expect(state.writes).toEqual([]);
  });
  it("série sans match : réutilisée, match inséré AVANT la mise à jour de la série", async () => {
    const { state, deps } = setup({ series: [{ id: "s1", slot_index: 20261020 }] });
    await runDailyDraw(deps, opts());
    expect(state.writes).toEqual(["insert:matches", "update:series", "insert:entity_mappings", "insert:audit_logs"]);
  });
  it("dry-run : aucune écriture", async () => {
    const { state, deps } = setup();
    const r = await runDailyDraw(deps, opts({ dryRun: true }));
    expect(r.drawn).toEqual(["2026-10-20"]);
    expect(state.writes).toEqual([]);
  });
  it("quota sous le seuil : arrêt après le jour courant", async () => {
    const { deps, fetched } = setup({}, { calls: [], remaining: 5 });
    const r = await runDailyDraw(deps, opts({ days: ["2026-10-20", "2026-10-21"] }));
    expect(r.stoppedOnQuota).toBe(true);
    expect(fetched.calls).toEqual(["2026-10-20"]);
  });
  it("aucune compétition active ou mauvais type : erreur", async () => {
    await expect(runDailyDraw(setup({ competition: null }).deps, opts())).rejects.toThrow("Aucune compétition ACTIVE");
    await expect(runDailyDraw(setup({ competition: { id: "c", name: "Cup", type: "NBA_CUP" } }).deps, opts())).rejects.toThrow(
      "pas DAILY_MATCH"
    );
  });
  it("échec du mapping : match supprimé et erreur", async () => {
    const { state, deps } = setup({ mappingError: "dup" });
    await expect(runDailyDraw(deps, opts())).rejects.toThrow("match supprimé");
    expect(state.writes).toContain("delete:matches");
    expect(state.writes).not.toContain("insert:audit_logs");
  });
});
