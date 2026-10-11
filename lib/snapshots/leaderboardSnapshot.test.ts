import { describe, it, expect, vi, beforeEach } from "vitest";

type Result = { data: unknown; error: { message: string } | null };
let competition: Result;
let existing: Result;
let scores: Result;
let written: Result;
let upsertArgs: { rows: Array<Record<string, unknown>>; opts: unknown } | null;

function chain(result: () => Result) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit"]) c[m] = () => c;
  c.maybeSingle = () => Promise.resolve(result());
  c.then = (resolve: (v: Result) => unknown) => resolve(result());
  return c;
}

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      if (table === "competitions") return chain(() => competition);
      if (table === "user_scores") return chain(() => scores);
      return {
        ...chain(() => existing),
        upsert: (rows: Array<Record<string, unknown>>, opts: unknown) => {
          upsertArgs = { rows, opts };
          return { select: () => Promise.resolve(written) };
        },
      };
    },
  }),
}));

import { runLeaderboardSnapshot } from "./leaderboardSnapshot";

const SUMMER_BEFORE = Date.parse("2026-10-20T07:59:00Z"); // 09:59 Paris
const SUMMER_AT = Date.parse("2026-10-20T08:00:00Z"); // 10:00 Paris
const WINTER_BEFORE = Date.parse("2026-10-26T08:30:00Z"); // 09:30 Paris
const WINTER_AT = Date.parse("2026-10-26T09:00:00Z"); // 10:00 Paris

const scoreRows = [
  { user_id: "a", total_points: 10, correct_match_winners: 3, exact_margins: 1, bracket_points: 0 },
  { user_id: "b", total_points: 10, correct_match_winners: 2, exact_margins: 1, bracket_points: 0 },
  { user_id: "c", total_points: 4, correct_match_winners: 1, exact_margins: 0, bracket_points: 0 },
];

beforeEach(() => {
  competition = { data: { id: "comp" }, error: null };
  existing = { data: [], error: null };
  scores = { data: scoreRows, error: null };
  written = { data: [{ user_id: "a" }, { user_id: "b" }, { user_id: "c" }], error: null };
  upsertArgs = null;
});

describe("runLeaderboardSnapshot", () => {
  it("n'écrit rien avant 10h Paris, été comme hiver", async () => {
    expect(await runLeaderboardSnapshot(SUMMER_BEFORE)).toEqual({ snapshotted: 0, skipped: "avant 10h" });
    expect(await runLeaderboardSnapshot(WINTER_BEFORE)).toEqual({ snapshotted: 0, skipped: "avant 10h" });
    expect(upsertArgs).toBeNull();
  });

  it("fige à 10h Paris (08:00Z en été, 09:00Z en hiver)", async () => {
    expect((await runLeaderboardSnapshot(SUMMER_AT)).snapshotted).toBe(3);
    expect(upsertArgs?.rows[0].snapshot_date).toBe("2026-10-20");
    expect((await runLeaderboardSnapshot(WINTER_AT)).snapshotted).toBe(3);
    expect(upsertArgs?.rows[0].snapshot_date).toBe("2026-10-26");
  });

  it("écrit rang (départage) et colonnes de départage, sans écraser", async () => {
    await runLeaderboardSnapshot(SUMMER_AT);
    const byUser = Object.fromEntries(upsertArgs!.rows.map((r) => [r.user_id, r]));
    expect(byUser.a).toMatchObject({ rank: 1, correct_match_winners: 3, exact_margins: 1, total_points: 10 });
    expect(byUser.b).toMatchObject({ rank: 2, correct_match_winners: 2 });
    expect(byUser.c).toMatchObject({ rank: 3 });
    expect(upsertArgs?.opts).toMatchObject({ ignoreDuplicates: true });
  });

  it("ne réécrit pas un jour déjà figé, même avec force", async () => {
    existing = { data: [{ user_id: "a" }], error: null };
    expect(await runLeaderboardSnapshot(SUMMER_AT)).toEqual({ snapshotted: 0, skipped: "déjà figé" });
    expect(await runLeaderboardSnapshot(SUMMER_AT, { force: true })).toEqual({ snapshotted: 0, skipped: "déjà figé" });
    expect(upsertArgs).toBeNull();
  });

  it("force lève seulement la garde des 10h", async () => {
    const result = await runLeaderboardSnapshot(SUMMER_BEFORE, { force: true });
    expect(result.snapshotted).toBe(3);
  });

  it("signale un figement tardif", async () => {
    const result = await runLeaderboardSnapshot(SUMMER_AT + 4 * 60 * 60 * 1000);
    expect(result.late).toBe(true);
    expect((await runLeaderboardSnapshot(SUMMER_AT + 60 * 60 * 1000)).late).toBeUndefined();
  });

  it("aucune compétition active ou aucun score : rien d'écrit", async () => {
    competition = { data: null, error: null };
    expect(await runLeaderboardSnapshot(SUMMER_AT)).toEqual({ snapshotted: 0, skipped: "aucune compétition active" });
    competition = { data: { id: "comp" }, error: null };
    scores = { data: [], error: null };
    expect(await runLeaderboardSnapshot(SUMMER_AT)).toEqual({ snapshotted: 0, skipped: "aucun score" });
  });

  it("remonte les erreurs Supabase au lieu de les avaler", async () => {
    competition = { data: null, error: { message: "plusieurs lignes" } };
    await expect(runLeaderboardSnapshot(SUMMER_AT)).rejects.toThrow(/compétition/);
    competition = { data: { id: "comp" }, error: null };
    scores = { data: null, error: { message: "boom" } };
    await expect(runLeaderboardSnapshot(SUMMER_AT)).rejects.toThrow(/scores/);
    scores = { data: scoreRows, error: null };
    written = { data: null, error: { message: "column not found" } };
    await expect(runLeaderboardSnapshot(SUMMER_AT)).rejects.toThrow(/Écriture/);
  });
});
