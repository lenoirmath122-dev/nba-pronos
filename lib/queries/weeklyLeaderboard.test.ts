import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
type One = { data: Row | null; error: null };

let frozenRow: One; // weekly_rankings filtré sur week_end_date
let latestRow: One; // dernier weekly_rankings
let earliestSnapshot: One; // premier snapshot >= weekStart
let beforeSnapshot: One; // un snapshot < weekStart
let rowsByDate: Record<string, Row[]>;
let scores: Row[];
let champions: Row[];
let profiles: Row[];
let league: One;
let members: Row[];
let failing: Set<string>; // "table" ou "table:gte" / "table:lt" en erreur

// Chaîne PostgREST minimale : mémorise les filtres, résout selon la table.
function query(table: string) {
  const filters: Record<string, unknown> = {};
  const c: Record<string, unknown> = {};
  for (const m of ["select", "in", "order", "limit"]) c[m] = () => c;
  c.eq = (column: string, value: unknown) => {
    filters[`eq:${column}`] = value;
    return c;
  };
  c.gte = () => {
    filters.gte = true;
    return c;
  };
  c.lt = () => {
    filters.lt = true;
    return c;
  };
  const failed = (): boolean =>
    failing.has(table) || (filters.gte === true && failing.has(`${table}:gte`)) || (filters.lt === true && failing.has(`${table}:lt`)) ||
    ("eq:snapshot_date" in filters && failing.has(`${table}:rows`));
  const one = (): One => {
    if (failed()) return { data: null, error: { message: "boom" } } as never;
    if (table === "weekly_rankings") return "eq:week_end_date" in filters ? frozenRow : latestRow;
    if (table === "leaderboard_snapshots") return filters.gte ? earliestSnapshot : beforeSnapshot;
    if (table === "leagues") return league;
    return { data: null, error: null };
  };
  const many = (): { data: Row[]; error: { message: string } | null } => {
    if (failed()) return { data: [], error: { message: "boom" } };
    if (table === "leaderboard_snapshots") {
      return { data: rowsByDate[filters["eq:snapshot_date"] as string] ?? [], error: null };
    }
    if (table === "user_scores") return { data: scores, error: null };
    if (table === "weekly_champions") return { data: champions, error: null };
    if (table === "users") return { data: profiles, error: null };
    if (table === "league_memberships") return { data: members, error: null };
    return { data: [], error: null };
  };
  c.maybeSingle = () => Promise.resolve(one());
  c.then = (res: (v: unknown) => unknown) => res(many());
  return c;
}

vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));

import { getWeeklyLeaderboard } from "./weeklyLeaderboard";

const client = { from: (table: string) => query(table) } as never;

// Mercredi 28/10/2026 : la semaine en cours a commencé le lundi 26/10 à 10h.
const WEDNESDAY = Date.parse("2026-10-28T10:00:00Z");

const snap = (user_id: string, total_points: number, cw: number | null = 0, em: number | null = 0) => ({
  user_id,
  total_points,
  correct_match_winners: cw,
  exact_margins: em,
});

const options = (overrides: Partial<{ leagueId: string | null; userId: string | null }> = {}) => ({
  competitionId: "comp",
  leagueId: null,
  userId: "me",
  nowMs: WEDNESDAY,
  ...overrides,
});

beforeEach(() => {
  frozenRow = { data: null, error: null };
  latestRow = { data: null, error: null };
  earliestSnapshot = { data: { snapshot_date: "2026-10-26" }, error: null };
  beforeSnapshot = { data: { snapshot_date: "2026-10-19" }, error: null };
  rowsByDate = { "2026-10-26": [snap("me", 10), snap("bob", 10)] };
  scores = [snap("me", 25, 3, 1), snap("bob", 20, 2, 0), snap("newbie", 7, 1, 0)];
  champions = [];
  profiles = [
    { id: "me", pseudo: "Moi", status: "ACTIVE" },
    { id: "bob", pseudo: "Bob", status: "ACTIVE" },
    { id: "newbie", pseudo: "Nouveau", status: "ACTIVE" },
  ];
  league = { data: null, error: null };
  members = [];
  failing = new Set();
});

describe("getWeeklyLeaderboard", () => {
  it("classe la semaine : fin (user_scores) moins début (snapshot du lundi)", async () => {
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.state).toBe("ok");
    expect(data.weekStart).toBe("2026-10-26");
    expect(data.endsAtIso).toBe("2026-11-02T09:00:00.000Z");
    expect(data.startSnapshotDate).toBe("2026-10-26");
    expect(data.late).toBe(false);
    expect(data.rows.map((r) => [r.userId, r.rank, r.points])).toEqual([
      ["me", 1, 15],
      ["bob", 2, 10],
      ["newbie", 3, 7], // inscrit en cours de semaine : absent du début = 0
    ]);
    expect(data.currentUserRank).toBe(1);
    expect(data.rankedCount).toBe(3);
  });

  it("marque le joueur courant et son pseudo", async () => {
    const data = await getWeeklyLeaderboard(client, options({ userId: "bob" }));
    const bob = data.rows.find((r) => r.userId === "bob");
    expect(bob).toMatchObject({ isCurrentUser: true, pseudo: "Bob" });
    expect(data.currentUserRank).toBe(2);
  });

  it("utilise la fin du figement précédent comme départ, même si un snapshot plus tôt existe", async () => {
    frozenRow = { data: { end_snapshot_date: "2026-10-27" }, error: null };
    earliestSnapshot = { data: { snapshot_date: "2026-10-26" }, error: null };
    rowsByDate = { "2026-10-27": [snap("me", 20), snap("bob", 10)] };
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.startSnapshotDate).toBe("2026-10-27");
    expect(data.late).toBe(true);
    expect(data.rows.find((r) => r.userId === "me")?.points).toBe(5);
  });

  it("signale un snapshot de départ pris en retard", async () => {
    earliestSnapshot = { data: { snapshot_date: "2026-10-27" }, error: null };
    rowsByDate = { "2026-10-27": [snap("me", 10), snap("bob", 10)] };
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.late).toBe(true);
    expect(data.startSnapshotDate).toBe("2026-10-27");
  });

  it("état pending : des snapshots existent, aucun depuis le lundi", async () => {
    earliestSnapshot = { data: null, error: null };
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.state).toBe("pending");
    expect(data.rows).toEqual([]);
    expect(data.rankedCount).toBe(0);
  });

  it("aucun snapshot du tout : tout le monde part de 0", async () => {
    earliestSnapshot = { data: null, error: null };
    beforeSnapshot = { data: null, error: null };
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.state).toBe("ok");
    expect(data.startSnapshotDate).toBeNull();
    expect(data.rows.map((r) => [r.userId, r.points])).toEqual([
      ["me", 25],
      ["bob", 20],
      ["newbie", 7],
    ]);
  });

  it("désactive le départage quand le snapshot de départ d'avant le lot 0 a des NULL", async () => {
    rowsByDate = { "2026-10-26": [snap("me", 10, null, null), snap("bob", 10, null, null)] };
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.tiebreakAvailable).toBe(false);
    expect(data.rows[0].correctMatchWinners).toBeNull();
  });

  it("garde des rangs partagés à égalité complète", async () => {
    scores = [snap("me", 20, 1, 1), snap("bob", 20, 1, 1)];
    rowsByDate = { "2026-10-26": [snap("me", 10, 0, 0), snap("bob", 10, 0, 0)] };
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("recalcule les rangs dans une ligue et masque le bandeau champion", async () => {
    league = { data: { id: "lg", name: "Les potes" }, error: null };
    members = [{ user_id: "bob" }, { user_id: "newbie" }];
    latestRow = { data: { week_end_date: "2026-10-26" }, error: null };
    champions = [{ user_id: "me", points: 30 }];
    const data = await getWeeklyLeaderboard(client, options({ leagueId: "lg" }));
    expect(data.scopeLeagueId).toBe("lg");
    expect(data.scopeLeagueName).toBe("Les potes");
    expect(data.rows.map((r) => [r.userId, r.rank])).toEqual([
      ["bob", 1],
      ["newbie", 2],
    ]);
    expect(data.currentUserRank).toBeNull();
    expect(data.lastChampions).toBeNull();
  });

  it("expose les co-champions de la dernière semaine figée", async () => {
    latestRow = { data: { week_end_date: "2026-10-26" }, error: null };
    champions = [
      { user_id: "me", points: 30 },
      { user_id: "bob", points: 30 },
    ];
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.lastChampions).toEqual({
      weekEndDate: "2026-10-26",
      champions: [
        { userId: "me", pseudo: "Moi", points: 30 },
        { userId: "bob", pseudo: "Bob", points: 30 },
      ],
    });
  });

  it("pas de bandeau quand la semaine figée n'a pas de champion", async () => {
    latestRow = { data: { week_end_date: "2026-10-26" }, error: null };
    champions = [];
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.lastChampions).toBeNull();
  });

  it("garde un total négatif (correction admin rétroactive)", async () => {
    scores = [snap("me", 5, 0, 0), snap("bob", 20, 0, 0)];
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.rows.find((r) => r.userId === "me")?.points).toBe(-5);
  });

  it("masque le bandeau quand la dernière semaine figée n'est pas celle qui vient de finir", async () => {
    latestRow = { data: { week_end_date: "2026-10-19" }, error: null };
    champions = [{ user_id: "me", points: 30 }];
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.lastChampions).toBeNull();
  });

  it("ordonne les ex æquo de façon stable (pseudo)", async () => {
    scores = [snap("z", 20, 0, 0), snap("a", 20, 0, 0)];
    rowsByDate = { "2026-10-26": [snap("z", 10, 0, 0), snap("a", 10, 0, 0)] };
    profiles = [
      { id: "z", pseudo: "Zoé", status: "ACTIVE" },
      { id: "a", pseudo: "Alex", status: "ACTIVE" },
    ];
    const data = await getWeeklyLeaderboard(client, options());
    expect(data.rows.map((r) => r.userId)).toEqual(["a", "z"]);
    expect(data.rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("lundi 11 h sans snapshot du lundi : pending, pas de repli sur la semaine d'avant", async () => {
    earliestSnapshot = { data: null, error: null };
    const data = await getWeeklyLeaderboard(client, { ...options(), nowMs: Date.parse("2026-10-26T10:00:00Z") });
    expect(data.state).toBe("pending");
    expect(data.weekStart).toBe("2026-10-26");
  });

  it.each([["leaderboard_snapshots:gte"], ["leaderboard_snapshots:lt"], ["leaderboard_snapshots:rows"], ["user_scores"]])(
    "erreur de lecture (%s) : état error, jamais les totaux généraux",
    async (failure) => {
      failing = new Set([failure]);
      const data = await getWeeklyLeaderboard(client, options());
      expect(data.state).toBe("error");
      expect(data.rows).toEqual([]);
    },
  );
});
