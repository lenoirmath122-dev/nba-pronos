import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/scoring/recompute", () => ({ recomputeMatch: vi.fn() }));
vi.mock("@/lib/scoring/advancement", () => ({ advanceWinnerIfDecided: vi.fn() }));

const updates: unknown[] = [];
const upserts: unknown[] = [];
let tables: Record<string, unknown> = {};
let updateData: unknown[] = [{ id: "m1" }];
let failingTable: string | null = null;

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        neq: () => chain,
        gte: () => chain,
        lte: () => chain,
        in: () => chain,
        maybeSingle: () => Promise.resolve(failingTable === table ? { data: null, error: { message: "down" } } : { data: tables[table], error: null }),
        upsert: (p: unknown) => {
          upserts.push(p);
          return Promise.resolve({ error: null });
        },
        update: (p: unknown) => {
          updates.push(p);
          const upd = { eq: () => upd, select: () => Promise.resolve({ data: updateData, error: null }) };
          return upd;
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve(failingTable === table ? { data: null, error: { message: "down" } } : { data: tables[table], error: null }),
      };
      return chain;
    },
  }),
}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { syncResultsFromNba } from "./resultsNba";
import { nbaLiveGameSchema, nbaLivePayloadSchema, normalizeNbaGame, type NbaLivePayload } from "@/lib/nba/nbaLive";

const periods = (scores: number[]) => scores.map((score, i) => ({ period: i + 1, score }));
const finishedGame = (over: Partial<NbaLivePayload["games"][number]> = {}): NbaLivePayload["games"][number] => ({
  gameId: "0012600001",
  gameStatus: 3,
  gameStatusText: "Final",
  period: 4,
  gameTimeUTC: "2026-10-08T00:00:00Z",
  homeTeam: { teamTricode: "LAL", score: 100, periods: periods([25, 25, 25, 25]) },
  awayTeam: { teamTricode: "GSW", score: 80, periods: periods([20, 20, 20, 20]) },
  ...over,
});
const payload = (games = [finishedGame()], dryRun?: boolean): NbaLivePayload => ({ source: "NBA_CDN_SCOREBOARD", games, dryRun });

const appRow = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  series_id: "s1",
  status: "IN_PROGRESS",
  home_score: null,
  away_score: null,
  went_to_ot: null,
  quarter_scores: null,
  scheduled_at: "2026-10-08T00:00:00+00:00", // 20h NY le 07/10, même jour NY que le coup d'envoi NBA
  home_team_id: "t-lal",
  away_team_id: "t-gsw",
  ...over,
});

beforeEach(() => {
  updates.length = 0;
  upserts.length = 0;
  updateData = [{ id: "m1" }];
  failingTable = null;
  tables = {
    competitions: { id: "c1" },
    entity_mappings: [],
    teams: [
      { id: "t-lal", abbreviation: "LAL" },
      { id: "t-gsw", abbreviation: "GSW" },
    ],
    matches: [appRow()],
  };
});

describe("syncResultsFromNba", () => {
  it("rapproche par jour NY + paire de tricodes, mappe NBA_LIVE, écrit et signale finishedNow", async () => {
    const r = await syncResultsFromNba(payload());
    expect(r.changed).toBe(1);
    expect(r.finishedNow).toEqual(["m1"]);
    expect(upserts).toEqual([expect.objectContaining({ entity_type: "MATCH", source_type: "NBA_LIVE", source_ref: "0012600001", internal_id: "m1" })]);
    expect(updates).toEqual([expect.objectContaining({ status: "FINISHED", home_score: 100, away_score: 80, went_to_ot: false })]);
  });

  it("remet les scores dans le sens de l'app quand la NBA inverse domicile/extérieur", async () => {
    tables.matches = [appRow({ home_team_id: "t-gsw", away_team_id: "t-lal" })];
    await syncResultsFromNba(payload());
    expect(updates).toEqual([expect.objectContaining({ home_score: 80, away_score: 100, quarter_scores: { homeTeam: [20, 20, 20, 20], awayTeam: [25, 25, 25, 25] } })]);
  });

  it("dryRun : calcule les écarts sans rien écrire ni mapper", async () => {
    const r = await syncResultsFromNba(payload([finishedGame()], true));
    expect(r.dryRun).toBe(true);
    expect(r.changed).toBe(1);
    expect(r.dryRunDiffs).toEqual([
      { gameId: "0012600001", matchId: "m1", from: "IN_PROGRESS", to: "FINISHED", fields: ["status", "home_score", "away_score", "went_to_ot", "quarter_scores"] },
    ]);
    expect(updates).toHaveLength(0);
    expect(upserts).toHaveLength(0);
    expect(r.finishedNow).toEqual([]);
  });

  it("idempotent : un résultat déjà à jour ne déclenche aucune écriture", async () => {
    tables.matches = [
      appRow({ status: "FINISHED", home_score: 100, away_score: 80, went_to_ot: false, quarter_scores: { homeTeam: [25, 25, 25, 25], awayTeam: [20, 20, 20, 20] } }),
    ];
    const r = await syncResultsFromNba(payload());
    expect(r.unchanged).toBe(1);
    expect(r.changed).toBe(0);
    expect(updates).toHaveLength(0);
  });

  it("aucun candidat : compté en unmapped, pas en skipped", async () => {
    tables.matches = [];
    const r = await syncResultsFromNba(payload());
    expect(r.unmapped).toBe(1);
    expect(r.skipped).toEqual([]);
  });

  it("deux candidats : ignoré comme ambigu", async () => {
    tables.matches = [appRow(), appRow({ id: "m2" })];
    const r = await syncResultsFromNba(payload());
    expect(r.skipped).toEqual([{ gameId: "0012600001", reason: expect.stringContaining("ambigu") }]);
    expect(updates).toHaveLength(0);
  });

  it("autre jour NY : pas de rapprochement (pas de tolérance ±1 jour)", async () => {
    tables.matches = [appRow({ scheduled_at: "2026-10-09T00:00:00+00:00" })];
    const r = await syncResultsFromNba(payload());
    expect(r.unmapped).toBe(1);
  });

  it("utilise le mapping en cache sans refaire le rapprochement", async () => {
    tables.entity_mappings = [{ internal_id: "m1", source_ref: "0012600001" }];
    tables.matches = [appRow({ scheduled_at: "2026-10-20T00:00:00+00:00" })]; // reporté : le rapprochement échouerait
    const r = await syncResultsFromNba(payload());
    expect(r.changed).toBe(1);
    expect(upserts).toHaveLength(0);
  });

  it("refuse la régression FINISHED -> IN_PROGRESS", async () => {
    tables.matches = [appRow({ status: "FINISHED", home_score: 100, away_score: 80 })];
    const live = finishedGame({ gameStatus: 2, gameStatusText: "Q4", period: 4 });
    const r = await syncResultsFromNba(payload([live]));
    expect(r.skipped).toEqual([{ gameId: "0012600001", reason: expect.stringContaining("régression") }]);
    expect(updates).toHaveLength(0);
  });

  it("écriture concurrente : ignoré, sans finishedNow", async () => {
    updateData = [];
    const r = await syncResultsFromNba(payload());
    expect(r.skipped).toEqual([{ gameId: "0012600001", reason: expect.stringContaining("concurrente") }]);
    expect(r.finishedNow).toEqual([]);
  });

  it("sans compétition ACTIVE : ne fait rien", async () => {
    tables.competitions = null;
    const r = await syncResultsFromNba(payload());
    expect(r.noActiveCompetition).toBe(true);
    expect(updates).toHaveLength(0);
  });

  it("match NBA incohérent : ignoré, les autres sont traités", async () => {
    const bad = finishedGame({ gameId: "0012600002", homeTeam: { teamTricode: "LAL", score: 999, periods: periods([25, 25, 25, 25]) } });
    const r = await syncResultsFromNba(payload([bad, finishedGame()]));
    expect(r.skipped).toEqual([{ gameId: "0012600002", reason: "incohérence score/périodes" }]);
    expect(r.changed).toBe(1);
  });

  it("lève une erreur si une requête Supabase échoue (pas de « tout non mappé » silencieux)", async () => {
    failingTable = "teams";
    await expect(syncResultsFromNba(payload())).rejects.toThrow("teams : down");
    failingTable = "competitions";
    await expect(syncResultsFromNba(payload())).rejects.toThrow("competitions : down");
  });

  it("mapping en cache incohérent avec les équipes : ignoré, rien d'écrit", async () => {
    tables.entity_mappings = [{ internal_id: "m1", source_ref: "0012600001" }];
    tables.teams = [
      { id: "t-lal", abbreviation: "LAL" },
      { id: "t-gsw", abbreviation: "BOS" },
    ];
    const r = await syncResultsFromNba(payload());
    expect(r.skipped).toEqual([{ gameId: "0012600001", reason: expect.stringContaining("incohérent") }]);
    expect(updates).toHaveLength(0);
  });

  it("doublon de gameId dans le corps : traité une seule fois", async () => {
    const r = await syncResultsFromNba(payload([finishedGame(), finishedGame()]));
    expect(r.changed).toBe(1);
    expect(updates).toHaveLength(1);
  });

  it("refuse FINISHED -> POSTPONED (seul l'admin défait un match terminé)", async () => {
    tables.matches = [appRow({ status: "FINISHED", home_score: 100, away_score: 80 })];
    const ppd = finishedGame({ gameStatus: 1, gameStatusText: "PPD", period: 0, homeTeam: { teamTricode: "LAL", score: 0, periods: [] }, awayTeam: { teamTricode: "GSW", score: 0, periods: [] } });
    const r = await syncResultsFromNba(payload([ppd]));
    expect(r.skipped[0].reason).toContain("régression");
    expect(updates).toHaveLength(0);
  });

  it("dryRun : ne compte pas comme changé une écriture que le vrai mode refuserait", async () => {
    tables.matches = [appRow({ status: "FINISHED", home_score: 100, away_score: 80 })];
    const live = finishedGame({ gameStatus: 2, gameStatusText: "Q4", period: 4 });
    const r = await syncResultsFromNba(payload([live], true));
    expect(r.changed).toBe(0);
    expect(r.dryRunDiffs).toEqual([]);
  });

  it("match tardif : 23h30 NY (jour UTC suivant) se rapproche sur le jour NY", async () => {
    tables.matches = [appRow({ scheduled_at: "2026-10-08T03:30:00+00:00" })]; // 23h30 NY le 07/10
    const r = await syncResultsFromNba(payload([finishedGame({ gameTimeUTC: "2026-10-08T03:30:00Z" })]));
    expect(r.changed).toBe(1);
  });

  it("IN_PROGRESS en tout début de match (period 0) : pas d'ignoré parasite", async () => {
    const start = finishedGame({
      gameStatus: 2,
      gameStatusText: "Q1 12:00",
      period: 0,
      homeTeam: { teamTricode: "LAL", score: 0, periods: periods([0, 0, 0, 0]) },
      awayTeam: { teamTricode: "GSW", score: 0, periods: periods([0, 0, 0, 0]) },
    });
    const r = await syncResultsFromNba(payload([start]));
    expect(r.skipped).toEqual([]);
    expect(r.changed).toBe(1);
  });

  // Régressions constatées sur le premier dryRun réel (08/10/2026) : faux « changed » à chaque passage.
  it("FINISHED identique, quarter_scores stockées dans l'ordre jsonb {awayTeam, homeTeam} : unchanged", async () => {
    tables.matches = [
      appRow({ status: "FINISHED", home_score: 100, away_score: 80, went_to_ot: false, quarter_scores: { awayTeam: [20, 20, 20, 20], homeTeam: [25, 25, 25, 25] } }),
    ];
    for (const dryRun of [false, true]) {
      const r = await syncResultsFromNba(payload([finishedGame()], dryRun));
      expect(r.unchanged).toBe(1);
      expect(r.changed).toBe(0);
    }
    expect(updates).toHaveLength(0);
  });

  it("match à venir côté NBA, 0/0/false/{[],[]} côté app : unchanged, rien d'écrit, en réel comme en dryRun", async () => {
    tables.matches = [appRow({ status: "SCHEDULED", home_score: 0, away_score: 0, went_to_ot: false, quarter_scores: { awayTeam: [], homeTeam: [] } })];
    const scheduled = finishedGame({
      gameStatus: 1,
      gameStatusText: "7:00 pm ET",
      period: 0,
      homeTeam: { teamTricode: "LAL", score: 0, periods: [] },
      awayTeam: { teamTricode: "GSW", score: 0, periods: [] },
    });
    for (const dryRun of [false, true]) {
      const r = await syncResultsFromNba(payload([scheduled], dryRun));
      expect(r.unchanged).toBe(1);
      expect(r.changed).toBe(0);
      expect(r.dryRunDiffs).toEqual([]);
    }
    expect(updates).toHaveLength(0);
  });

  it("SCHEDULED -> POSTPONED reste un vrai changement", async () => {
    tables.matches = [appRow({ status: "SCHEDULED" })];
    const ppd = finishedGame({ gameStatus: 1, gameStatusText: "PPD", period: 0, homeTeam: { teamTricode: "LAL", score: 0, periods: [] }, awayTeam: { teamTricode: "GSW", score: 0, periods: [] } });
    const r = await syncResultsFromNba(payload([ppd]));
    expect(r.changed).toBe(1);
    expect(updates).toEqual([expect.objectContaining({ status: "POSTPONED" })]);
  });

  describe("capture réelle ScoreboardV3 (match 0012600029, IND-MIN, 07/10/2026)", () => {
    const reduced = () =>
      JSON.parse(readFileSync(join(process.cwd(), "Cadrage/Stats/service/tests/fixtures/scoreboardv3_reduced.json"), "utf8")) as NbaLivePayload["games"][number];
    const indMinTables = (homeId: string, awayId: string) => ({
      competitions: { id: "c1" },
      entity_mappings: [],
      teams: [
        { id: "t-ind", abbreviation: "IND" },
        { id: "t-min", abbreviation: "MIN" },
      ],
      matches: [appRow({ scheduled_at: "2026-10-07T23:00:00+00:00", home_team_id: homeId, away_team_id: awayId })],
    });
    const realPayload = (dryRun?: boolean): NbaLivePayload => ({ source: "NBA_STATS_SCOREBOARDV3", games: [reduced()], dryRun });

    it("est acceptée par le schéma zod de la route", () => {
      expect(nbaLivePayloadSchema.safeParse(realPayload()).success).toBe(true);
    });

    it("normalise en FINISHED 123-112 sans prolongation", () => {
      const parsed = nbaLiveGameSchema.parse(reduced());
      const n = normalizeNbaGame(parsed);
      expect(n.ok && n.game.result).toEqual({
        status: "FINISHED",
        home_score: 123,
        away_score: 112,
        went_to_ot: false,
        quarter_scores: { homeTeam: [32, 29, 38, 24], awayTeam: [27, 38, 26, 21] },
      });
    });

    it("s'écrit dans le sens de l'app, y compris quand l'app a les équipes inversées, puis un 2e passage est unchanged", async () => {
      tables = indMinTables("t-ind", "t-min");
      expect((await syncResultsFromNba(realPayload())).changed).toBe(1);
      expect(updates).toEqual([expect.objectContaining({ home_score: 123, away_score: 112, quarter_scores: { homeTeam: [32, 29, 38, 24], awayTeam: [27, 38, 26, 21] } })]);

      updates.length = 0;
      tables = indMinTables("t-min", "t-ind");
      await syncResultsFromNba(realPayload());
      expect(updates).toEqual([expect.objectContaining({ home_score: 112, away_score: 123, quarter_scores: { homeTeam: [27, 38, 26, 21], awayTeam: [32, 29, 38, 24] } })]);

      updates.length = 0;
      tables = indMinTables("t-ind", "t-min");
      (tables.matches as Record<string, unknown>[])[0] = appRow({
        scheduled_at: "2026-10-07T23:00:00+00:00",
        home_team_id: "t-ind",
        away_team_id: "t-min",
        status: "FINISHED",
        home_score: 123,
        away_score: 112,
        went_to_ot: false,
        quarter_scores: { awayTeam: [27, 38, 26, 21], homeTeam: [32, 29, 38, 24] },
      });
      const again = await syncResultsFromNba(realPayload());
      expect(again.unchanged).toBe(1);
      expect(updates).toHaveLength(0);
    });
  });
});
