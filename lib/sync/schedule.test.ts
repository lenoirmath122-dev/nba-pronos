import { describe, it, expect, vi, beforeEach } from "vitest";

const getMatchesByDate = vi.fn();
vi.mock("@/lib/nba/client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/nba/client")>()),
  getMatchesByDate: (d: string) => getMatchesByDate(d),
}));

type Fixture = {
  competitionType: string;
  series: { id: string; competition_id: string; team1_id: string | null; team2_id: string | null; official_status: string; slot_index: number | null; round?: string }[];
  matchRows: { id: string; series_id: string }[];
  matchMappings: { internal_id: string; source_ref: string }[];
};
let fx: Fixture;
const updates: { table: string; payload: unknown }[] = [];
const inserts: { table: string; payload: unknown }[] = [];

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      let entityType: string | null = null;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (col: string, val: string) => {
          if (col === "entity_type") entityType = val;
          return chain;
        },
        in: () => Promise.resolve({ data: fx.matchRows }),
        not: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: table === "matches" ? { scheduled_at: "2026-12-04T23:00:00.000Z" } : { id: "c1", type: fx.competitionType },
          }),
        update: (payload: unknown) => {
          updates.push({ table, payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        insert: (payload: unknown) => {
          inserts.push({ table, payload });
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-match" }, error: null }) }) };
        },
        upsert: () => Promise.resolve({ error: null }),
        // `await supabase.from(t).select().eq().eq()` (Promise.all de la synchro).
        then: (resolve: (v: unknown) => unknown) => {
          let data: unknown[] = [];
          if (table === "entity_mappings") {
            data =
              entityType === "TEAM"
                ? [
                    { internal_id: "t-bos", source_ref: "1" },
                    { internal_id: "t-nyk", source_ref: "2" },
                  ]
                : fx.matchMappings;
          } else if (table === "series") {
            data = fx.series;
          }
          return Promise.resolve({ data }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));

import { syncSchedule } from "./schedule";

const raw = (id: number, date = "2026-10-21T00:00:00.000Z", home = 1, away = 2) => ({
  id,
  league: "NBA",
  date,
  state: { description: "Scheduled", score: { homeTeam: [], awayTeam: [] } },
  homeTeam: { id: home },
  awayTeam: { id: away },
});

// Une seule requête API par jour de l'horizon : on renvoie le même lot à chaque appel.
const NOW = new Date("2026-10-20T12:00:00Z");

describe("syncSchedule", () => {
  beforeEach(() => {
    getMatchesByDate.mockReset();
    updates.length = 0;
    inserts.length = 0;
  });

  it("Playoffs : un match inconnu est rattaché à la série de la paire d'équipes (non-régression)", async () => {
    fx = {
      competitionType: "PLAYOFFS",
      series: [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "IN_PROGRESS", slot_index: 0 }],
      matchRows: [],
      matchMappings: [],
    };
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(10)], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    const r = await syncSchedule(NOW);
    expect(r.created).toBe(1);
    expect(r.ignoredNotDrawn).toBe(0);
    expect(inserts.some((i) => i.table === "matches")).toBe(true);
  });

  it("NBA_CUP : la synchro pose bracket_deadline après avoir créé des matchs", async () => {
    fx = {
      competitionType: "NBA_CUP",
      series: [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "SCHEDULED", slot_index: 0 }],
      matchRows: [],
      matchMappings: [],
    };
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(10)], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    const r = await syncSchedule(NOW);
    expect(r.created).toBe(1);
    expect(updates).toContainEqual({ table: "competitions", payload: { bracket_deadline: "2026-12-04T23:00:00.000Z" } });
  });

  it("NBA_CUP : un match de demie hors du 08-09/12 est ignoré, dans la fenêtre il est rattaché", async () => {
    const series = [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "SCHEDULED", slot_index: 0, round: "CUP_SEMIS" }];
    fx = { competitionType: "NBA_CUP", series, matchRows: [], matchMappings: [] };
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(10, "2026-12-02T01:00:00.000Z")], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    const out = await syncSchedule(NOW);
    expect(out.created).toBe(0);
    expect(out.skipped[0].reason).toContain("hors fenêtre");
    getMatchesByDate.mockReset();
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(11, "2026-12-09T01:00:00.000Z")], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    expect((await syncSchedule(NOW)).created).toBe(1);
  });

  it("DAILY_MATCH : aucune bracket_deadline posée (pas de bracket)", async () => {
    fx = {
      competitionType: "DAILY_MATCH",
      series: [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "IN_PROGRESS", slot_index: 20261020 }],
      matchRows: [{ id: "m1", series_id: "s1" }],
      matchMappings: [{ internal_id: "m1", source_ref: "99" }],
    };
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(99)], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    await syncSchedule(NOW);
    expect(updates.some((u) => u.table === "competitions")).toBe(false);
  });

  it("DAILY_MATCH : un match non tiré n'est jamais créé ni listé dans skipped", async () => {
    fx = {
      competitionType: "DAILY_MATCH",
      series: [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "IN_PROGRESS", slot_index: 20261020 }],
      matchRows: [{ id: "m1", series_id: "s1" }],
      matchMappings: [{ internal_id: "m1", source_ref: "99" }],
    };
    // Même paire BOS-NYK qu'une série existante : en Playoffs elle serait rattachée.
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(10)], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    const r = await syncSchedule(NOW);
    expect(r.created).toBe(0);
    expect(r.ignoredNotDrawn).toBe(1);
    expect(r.skipped).toEqual([]);
    expect(inserts).toEqual([]);
  });

  it("DAILY_MATCH : le match tiré (mappé) voit son horaire mis à jour", async () => {
    fx = {
      competitionType: "DAILY_MATCH",
      series: [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "IN_PROGRESS", slot_index: 20261020 }],
      matchRows: [{ id: "m1", series_id: "s1" }],
      matchMappings: [{ internal_id: "m1", source_ref: "99" }],
    };
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(99, "2026-10-21T00:30:00.000Z")], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    const r = await syncSchedule(NOW);
    expect(r.updated).toBe(1);
    expect(r.dayMoved).toEqual([]);
    expect(updates).toHaveLength(1);
  });

  it("DAILY_MATCH : un report vers un autre jour NY est signalé (dayMoved)", async () => {
    fx = {
      competitionType: "DAILY_MATCH",
      series: [{ id: "s1", competition_id: "c1", team1_id: "t-bos", team2_id: "t-nyk", official_status: "IN_PROGRESS", slot_index: 20261020 }],
      matchRows: [{ id: "m1", series_id: "s1" }],
      matchMappings: [{ internal_id: "m1", source_ref: "99" }],
    };
    // 2026-10-22T00:00Z = 21/10 20h NY : le match tiré le 20/10 est décalé au 21/10.
    getMatchesByDate.mockResolvedValueOnce({ data: [raw(99, "2026-10-22T00:00:00.000Z")], requestsRemaining: 9 }).mockResolvedValue({ data: [], requestsRemaining: 9 });
    const r = await syncSchedule(NOW);
    expect(r.dayMoved).toEqual([{ highlightlyMatchId: 99, slotDay: "20261020", newNyDay: "2026-10-21" }]);
  });
});
