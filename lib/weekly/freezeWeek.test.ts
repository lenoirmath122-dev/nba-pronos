import { describe, it, expect, vi, beforeEach } from "vitest";

type Result = { data: unknown; error: { message: string } | null };
type Row = Record<string, unknown>;

let competition: Result;
let headers: Result;
let snapshotDates: { after: Row[]; before: Row[] };
let rowsByDate: Record<string, Row[]>;
let rpcResult: Result;
let rpcCalls: Array<{ fn: string; args: Row }>;

// Chaîne PostgREST minimale : mémorise les filtres, résout selon la table.
function query(table: string) {
  const filters: Record<string, unknown> = {};
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) {
    c[m] = (...args: unknown[]) => {
      if (m === "eq") filters[`eq:${args[0]}`] = args[1];
      return c;
    };
  }
  c.gte = () => {
    filters.gte = true;
    return c;
  };
  c.lte = () => {
    filters.lte = true;
    return c;
  };
  const resolve = (): Result => {
    if (table === "weekly_rankings") return headers;
    if (filters.gte) return { data: snapshotDates.after, error: null };
    if (filters.lte) return { data: snapshotDates.before, error: null };
    return { data: rowsByDate[filters["eq:snapshot_date"] as string] ?? [], error: null };
  };
  c.maybeSingle = () => Promise.resolve(competition);
  c.then = (res: (v: Result) => unknown) => res(resolve());
  return c;
}

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: (table: string) => query(table),
    rpc: (fn: string, args: Row) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  }),
}));

import { runWeeklyFreeze } from "./freezeWeek";

const MONDAY_26 = Date.parse("2026-10-26T09:00:00Z"); // 10h Paris (CET)

const snap = (user_id: string, total_points: number, cw = 0, em = 0) => ({
  user_id,
  total_points,
  correct_match_winners: cw,
  exact_margins: em,
});

beforeEach(() => {
  competition = { data: { id: "comp", weekly_ranking: true }, error: null };
  headers = { data: [], error: null };
  snapshotDates = { after: [{ snapshot_date: "2026-10-26" }], before: [{ snapshot_date: "2026-10-19" }] };
  rowsByDate = {
    "2026-10-19": [snap("a", 10), snap("b", 10)],
    "2026-10-26": [snap("a", 30), snap("b", 14)],
  };
  rpcResult = { data: true, error: null };
  rpcCalls = [];
});

describe("runWeeklyFreeze", () => {
  it("fige la semaine et passe le champion au RPC", async () => {
    const result = await runWeeklyFreeze(MONDAY_26);
    expect(result).toEqual({
      frozen: true,
      weekEnd: "2026-10-26",
      startSnapshotDate: "2026-10-19",
      endSnapshotDate: "2026-10-26",
      champions: 1,
      tiebreakAvailable: true,
    });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("freeze_weekly_ranking");
    expect(rpcCalls[0].args).toMatchObject({
      p_week_end_date: "2026-10-26",
      p_start_snapshot_date: "2026-10-19",
      p_frozen_by: "CRON",
      p_tiebreak_available: true,
      p_champions: [{ user_id: "a", points: 20, correct_match_winners: 0, exact_margins: 0 }],
    });
  });

  it("transmet frozenBy ADMIN", async () => {
    await runWeeklyFreeze(MONDAY_26, { frozenBy: "ADMIN" });
    expect(rpcCalls[0].args.p_frozen_by).toBe("ADMIN");
  });

  it("ignore sans compétition active", async () => {
    competition = { data: null, error: null };
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({ frozen: false, skipped: "aucune compétition active" });
  });

  it("ignore quand weekly_ranking est désactivé, sans RPC", async () => {
    competition = { data: { id: "comp", weekly_ranking: false }, error: null };
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({ skipped: "classement hebdo désactivé" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("semaine déjà figée : rien n'est recalculé", async () => {
    headers = { data: [{ week_end_date: "2026-10-26", end_snapshot_date: "2026-10-26" }], error: null };
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({ skipped: "déjà figé" });
    expect(rpcCalls).toHaveLength(0);
  });

  it("appel concurrent : le RPC répond false", async () => {
    rpcResult = { data: false, error: null };
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({ frozen: false, skipped: "déjà figé" });
  });

  it("repart de la fin de la semaine précédente figée (rattrapage)", async () => {
    headers = { data: [{ week_end_date: "2026-10-19", end_snapshot_date: "2026-10-20" }], error: null };
    rowsByDate["2026-10-20"] = [snap("a", 12), snap("b", 10)];
    const result = await runWeeklyFreeze(MONDAY_26);
    expect(result).toMatchObject({ frozen: true, startSnapshotDate: "2026-10-20" });
    expect(rpcCalls[0].args.p_champions).toMatchObject([{ user_id: "a", points: 18 }]);
  });

  it("snapshot de fin pris en retard : endLate", async () => {
    snapshotDates.after = [{ snapshot_date: "2026-10-27" }];
    rowsByDate["2026-10-27"] = rowsByDate["2026-10-26"];
    const result = await runWeeklyFreeze(Date.parse("2026-10-27T10:00:00Z"));
    expect(result).toMatchObject({ frozen: true, weekEnd: "2026-10-26", endSnapshotDate: "2026-10-27", endLate: true });
  });

  it("signale l'absence de snapshot de fin et la première semaine", async () => {
    snapshotDates.after = [];
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({ skipped: "snapshot de fin absent" });
    snapshotDates = { after: [{ snapshot_date: "2026-10-26" }], before: [] };
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({
      skipped: "première semaine (pas de snapshot de référence)",
    });
    expect(rpcCalls).toHaveLength(0);
  });

  it("départ trop ancien : le cron refuse, l'admin fige", async () => {
    headers = { data: [], error: null };
    snapshotDates.before = [{ snapshot_date: "2026-10-12" }];
    rowsByDate["2026-10-12"] = [snap("a", 0), snap("b", 0)];
    expect(await runWeeklyFreeze(MONDAY_26)).toMatchObject({
      frozen: false,
      skipped: "départ trop ancien (à figer depuis l'admin)",
    });
    expect(rpcCalls).toHaveLength(0);
    expect(await runWeeklyFreeze(MONDAY_26, { frozenBy: "ADMIN" })).toMatchObject({
      frozen: true,
      startSnapshotDate: "2026-10-12",
      baselineLate: true,
    });
  });

  it("pas de champion si personne n'a marqué", async () => {
    rowsByDate["2026-10-26"] = [snap("a", 10), snap("b", 10)];
    const result = await runWeeklyFreeze(MONDAY_26);
    expect(result).toMatchObject({ frozen: true, champions: 0 });
    expect(rpcCalls[0].args.p_champions).toEqual([]);
  });

  it("une erreur de lecture (migration absente) remonte avec un message explicite", async () => {
    competition = { data: null, error: { message: 'column "weekly_ranking" does not exist' } };
    await expect(runWeeklyFreeze(MONDAY_26)).rejects.toThrow(/migration/);
    competition = { data: { id: "comp", weekly_ranking: true }, error: null };
    headers = { data: null, error: { message: 'relation "weekly_rankings" does not exist' } };
    await expect(runWeeklyFreeze(MONDAY_26)).rejects.toThrow(/migration/);
  });

  it("une erreur du RPC remonte", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    await expect(runWeeklyFreeze(MONDAY_26)).rejects.toThrow(/boom/);
  });
});
