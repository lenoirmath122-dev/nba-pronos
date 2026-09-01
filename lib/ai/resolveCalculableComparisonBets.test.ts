// Test d'ORCHESTRATION de resolveCalculableComparisonBets() (paris DUEL --
// 2 opérandes JOUEUR ou ÉQUIPE, 3 relations GT/DIFF_LT/OR). Même faux
// Supabase que les fichiers précédents.
//
// 7e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private op: "select" | "update" = "select";
  private patch: Row | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(private store: Row[]) {}

  select(cols?: string) {
    void cols;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }
  single<T = Row>() {
    this.singleMode = "single";
    return this as unknown as PromiseLike<{ data: T | null; error: { message: string } | null }>;
  }
  maybeSingle<T = Row>() {
    this.singleMode = "maybe";
    return this as unknown as PromiseLike<{ data: T | null; error: null }>;
  }

  private matched(): Row[] {
    return this.store.filter((r) => this.filters.every((f) => f(r)));
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const rows = this.matched();
    let result: unknown;
    if (this.op === "update") {
      for (const r of rows) Object.assign(r, this.patch);
      if (this.singleMode === "none") result = { data: rows, error: null };
      else result = { data: rows[0] ?? null, error: this.singleMode === "single" && !rows[0] ? { message: "not found" } : null };
    } else if (this.singleMode === "single") {
      result = { data: rows[0] ?? null, error: rows[0] ? null : { message: "not found" } };
    } else if (this.singleMode === "maybe") {
      result = { data: rows[0] ?? null, error: null };
    } else {
      result = { data: rows, error: null };
    }
    return Promise.resolve(onfulfilled ? onfulfilled(result) : (result as TResult1));
  }
}

class FakeSupabase {
  db: Record<string, Row[]> = {};
  from(table: string) {
    if (!this.db[table]) this.db[table] = [];
    return new FakeBuilder(this.db[table]);
  }
}

const fake = new FakeSupabase();

vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => fake,
}));

const { resolveCalculableComparisonBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";
const NBA_TEAM_A = 1610612738;

function boxScoreRow(overrides: Row): Row {
  return { game_id: GAME_ID, player_id: null, team_id: null, minutes: "30:00", pts: 0, reb: 0, ast: 0, ...overrides };
}

function duel(left: Row, right: Row, relation: "GT" | "DIFF_LT" | "OR", multiplier = 1) {
  return { left, right, relation, multiplier };
}

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_threshold: null,
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: "2026-04-15T23:00:00.000Z" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
  seed("teams", [{ id: "TEAM_A", abbreviation: "BOS" }]);
  seed("stats_equipes", [{ team_id: NBA_TEAM_A, tricode: "BOS" }]);
  seed("stats_box_scores", [
    boxScoreRow({ player_id: 201, pts: 28, reb: 6 }), // LeBron-like.
    boxScoreRow({ player_id: 202, pts: 20, reb: 10 }), // Jokic-like.
  ]);
});

describe("resolveCalculableComparisonBets — relation GT", () => {
  it("gauche > multiplicateur*droite -> WON (2 opérandes JOUEUR)", async () => {
    seed("bets", [
      betRow({
        id: "bet1",
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "GT"),
      }),
    ]); // 28 > 1*20.

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("multiplicateur appliqué au côté droit", async () => {
    seed("bets", [
      betRow({
        id: "bet2",
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "GT", 1.5),
      }),
    ]); // 28 > 1.5*20=30 ? non -> LOST.

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "LOST" }]);
  });
});

describe("resolveCalculableComparisonBets — relation DIFF_LT", () => {
  it("écart strictement inférieur au seuil -> WON", async () => {
    seed("bets", [
      betRow({
        id: "bet3", structured_threshold: 10,
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "DIFF_LT"),
      }),
    ]); // |28-20|=8 < 10.

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet3", outcome: "WON" }]);
  });

  it("écart EXACTEMENT égal au seuil -> LOST (convention stricte, comme computeOutcome)", async () => {
    seed("bets", [
      betRow({
        id: "bet4", structured_threshold: 8,
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "DIFF_LT"),
      }),
    ]); // |28-20|=8, pas < 8.

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet4", outcome: "LOST" }]);
  });

  it("seuil manquant pour DIFF_LT -> SKIPPED", async () => {
    seed("bets", [
      betRow({
        id: "bet5", structured_threshold: null,
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "DIFF_LT"),
      }),
    ]);

    const summary = await resolveCalculableComparisonBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "seuil manquant pour ce duel" }]);
  });
});

describe("resolveCalculableComparisonBets — relation OR", () => {
  it("l'un des 2 côtés dépasse le seuil -> WON", async () => {
    seed("bets", [
      betRow({
        id: "bet6", structured_threshold: 25,
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "OR"),
      }),
    ]); // gauche 28 > 25.

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet6", outcome: "WON" }]);
  });

  it("aucun des 2 côtés ne dépasse le seuil -> LOST", async () => {
    seed("bets", [
      betRow({
        id: "bet7", structured_threshold: 30,
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "OR"),
      }),
    ]);

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet7", outcome: "LOST" }]);
  });
});

describe("resolveCalculableComparisonBets — opérandes TEAM et 'min'", () => {
  it("opérande TEAM (resolveNbaTeamId) vs opérande JOUEUR sur 'min'", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ player_id: 201, team_id: NBA_TEAM_A, reb: 6, minutes: "38:00" }),
      boxScoreRow({ player_id: 202, team_id: NBA_TEAM_A, reb: 4 }),
    ]);
    seed("bets", [
      betRow({
        id: "bet8",
        structured_duel: duel({ kind: "TEAM", team_id: "TEAM_A", stat: "reb" }, { kind: "PLAYER", player_ids: [201], stat: "min" }, "GT"),
      }),
    ]); // gauche (équipe) 6+4=10 > droite (minutes) 38.

    const summary = await resolveCalculableComparisonBets();

    expect(summary.resolved).toEqual([{ betId: "bet8", outcome: "LOST" }]); // 10 > 38 est faux.
  });
});

describe("resolveCalculableComparisonBets — données manquantes et garde-fous", () => {
  it("un opérande sans donnée synchronisée -> SKIPPED, jamais tranché à tort", async () => {
    seed("bets", [
      betRow({
        id: "bet9",
        structured_duel: duel({ kind: "PLAYER", player_ids: [999], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "GT"),
      }),
    ]);

    const summary = await resolveCalculableComparisonBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "pas encore de stats synchronisées pour ce duel" }]);
  });

  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [
      betRow({
        id: "bet10",
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "GT"),
      }),
    ]);

    const summary = await resolveCalculableComparisonBets();

    expect(summary.skipped).toEqual([{ betId: "bet10", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("bets", [
      betRow({
        id: "bet11",
        structured_duel: duel({ kind: "PLAYER", player_ids: [201], stat: "pts" }, { kind: "PLAYER", player_ids: [202], stat: "pts" }, "GT"),
      }),
    ]); // trancherait WON.
    seed("correction_requests", [{ target_bet_id: "bet11", status: "PENDING" }]);

    const summary = await resolveCalculableComparisonBets();

    expect(summary.skipped).toEqual([{ betId: "bet11", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet11")?.status).toBe("VALIDATED");
  });
});
