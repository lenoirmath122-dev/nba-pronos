// Test d'ORCHESTRATION de resolveCalculablePeriodBets() — 2 formes
// distinguées par structured_period.player_id : JOUEUR
// (stats_box_scores_by_period, sommée sur les quarts-temps de la période)
// et ÉQUIPE (matches.quarter_scores DIRECTEMENT, via computePeriodTeamOutcome
// -- déjà couverte en détail par resolveCalculableBets.test.ts pour la
// logique pure ; ce fichier vérifie le CÂBLAGE : résolution team_id
// home/away, garde-fous, écriture du résultat).
//
// 8e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculablePeriodBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";

function periodBoxRow(overrides: Row): Row {
  return {
    game_id: GAME_ID, player_id: null, period: 1,
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0, minutes: 0,
    ...overrides,
  };
}

function structuredPeriod(overrides: Row): Row {
  return { period: null, outcome_kind: null, team_id: null, player_id: null, exact_count: null, ...overrides };
}

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_threshold: null,
    structured_comparison: null,
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [
    {
      id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B",
      home_score: 105, away_score: 95,
      quarter_scores: { homeTeam: [25, 28, 22, 30], awayTeam: [20, 24, 26, 25] }, // home mène 3 quarts sur 4.
    },
  ]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
});

describe("resolveCalculablePeriodBets — forme JOUEUR (stats_box_scores_by_period)", () => {
  it("somme les quarts-temps de la période (H1 = Q1+Q2) -> WON", async () => {
    seed("stats_box_scores_by_period", [
      periodBoxRow({ player_id: 201, period: 1, pts: 15 }),
      periodBoxRow({ player_id: 201, period: 2, pts: 13 }),
      periodBoxRow({ player_id: 201, period: 3, pts: 100 }), // hors H1 -- ne doit PAS compter.
    ]);
    seed("bets", [
      betRow({
        id: "bet1", structured_stat: "pts", structured_threshold: 20, structured_comparison: "OVER",
        structured_period: structuredPeriod({ player_id: 201, period: "H1" }),
      }),
    ]); // 15+13=28 > 20.

    const summary = await resolveCalculablePeriodBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("aucune ligne stats_box_scores_by_period -> SKIPPED", async () => {
    seed("bets", [
      betRow({
        id: "bet2", structured_stat: "pts", structured_threshold: 20, structured_comparison: "OVER",
        structured_period: structuredPeriod({ player_id: 999, period: "Q1" }),
      }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet2", reason: "pas encore de stats par période synchronisées pour ce joueur" }]);
  });

  it("stat ou période manquante -> SKIPPED", async () => {
    seed("bets", [
      betRow({ id: "bet3", structured_stat: null, structured_period: structuredPeriod({ player_id: 201, period: "Q1" }) }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "stat/période joueur manquante" }]);
  });

  it("seuil/comparaison manquant -> SKIPPED", async () => {
    seed("stats_box_scores_by_period", [periodBoxRow({ player_id: 201, period: 1, pts: 15 })]);
    seed("bets", [
      betRow({
        id: "bet4", structured_stat: "pts", structured_threshold: null, structured_comparison: null,
        structured_period: structuredPeriod({ player_id: 201, period: "Q1" }),
      }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "seuil/comparaison manquant pour ce pari joueur+période" }]);
  });
});

describe("resolveCalculablePeriodBets — forme ÉQUIPE (quarter_scores)", () => {
  it("outcome_kind ciblant une équipe (QUARTER_WINNER), team_id = home -> WON", async () => {
    seed("bets", [
      betRow({
        id: "bet5",
        structured_period: structuredPeriod({ outcome_kind: "QUARTER_WINNER", team_id: "TEAM_A", period: "Q1" }),
      }),
    ]); // home gagne Q1 (25 > 20).

    const summary = await resolveCalculablePeriodBets();

    expect(summary.resolved).toEqual([{ betId: "bet5", outcome: "WON" }]);
  });

  it("outcome_kind symétrique (MARGIN), aucune équipe requise", async () => {
    seed("bets", [
      betRow({
        id: "bet6", structured_threshold: 3, structured_comparison: "OVER",
        structured_period: structuredPeriod({ outcome_kind: "MARGIN", period: "Q3" }),
      }),
    ]); // cumul Q1-Q3 : home 75, away 70, écart 5 > 3.

    const summary = await resolveCalculablePeriodBets();

    expect(summary.resolved).toEqual([{ betId: "bet6", outcome: "WON" }]);
  });

  it("équipe visée manquante pour un outcome_kind ciblé -> SKIPPED", async () => {
    seed("bets", [
      betRow({ id: "bet7", structured_period: structuredPeriod({ outcome_kind: "QUARTER_WINNER", team_id: null, period: "Q1" }) }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "équipe visée manquante" }]);
  });

  it("équipe visée hors de ce match -> SKIPPED", async () => {
    seed("bets", [
      betRow({ id: "bet8", structured_period: structuredPeriod({ outcome_kind: "QUARTER_WINNER", team_id: "TEAM_ELSEWHERE", period: "Q1" }) }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet8", reason: "équipe visée hors de ce match" }]);
  });

  it("outcome_kind manquant -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet9", structured_period: structuredPeriod({ period: "Q1" }) })]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "outcome_kind manquant" }]);
  });

  it("quarter_scores absent -> SKIPPED (computePeriodTeamOutcome renvoie null)", async () => {
    seed("matches", [{ id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", home_score: null, away_score: null, quarter_scores: null }]);
    seed("bets", [
      betRow({ id: "bet10", structured_period: structuredPeriod({ outcome_kind: "QUARTER_WINNER", team_id: "TEAM_A", period: "Q1" }) }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet10", reason: "pas encore de score par quart-temps synchronisé pour ce match" }]);
  });
});

describe("resolveCalculablePeriodBets — garde-fous communs", () => {
  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED", quarter_scores: null }]);
    seed("bets", [
      betRow({ id: "bet11", structured_period: structuredPeriod({ outcome_kind: "QUARTER_WINNER", team_id: "TEAM_A", period: "Q1" }) }),
    ]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet11", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("bets", [
      betRow({ id: "bet12", structured_period: structuredPeriod({ outcome_kind: "QUARTER_WINNER", team_id: "TEAM_A", period: "Q1" }) }),
    ]); // trancherait WON.
    seed("correction_requests", [{ target_bet_id: "bet12", status: "PENDING" }]);

    const summary = await resolveCalculablePeriodBets();

    expect(summary.skipped).toEqual([{ betId: "bet12", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet12")?.status).toBe("VALIDATED");
  });
});
