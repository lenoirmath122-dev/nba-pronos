// Test d'ORCHESTRATION de resolveCalculableTechnicalFoulsCountBets()
// (comptage EXACT de fautes techniques -- scope MATCH, les 2 équipes sans
// filtre, ou team1/team2 via resolveNbaTeamId). Même faux Supabase que les
// fichiers précédents.
//
// 13e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableTechnicalFoulsCountBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";
const NBA_TEAM_A = 1610612738;

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_team_id: null,
    structured_threshold: 2,
    structured_technical_fouls_count: { scope: "MATCH", count_relation: "EXACTLY" },
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
  seed("teams", [{ id: "TEAM_A", abbreviation: "BOS" }]);
  seed("stats_equipes", [{ team_id: NBA_TEAM_A, tricode: "BOS" }]);
});

describe("resolveCalculableTechnicalFoulsCountBets — scope MATCH", () => {
  it("EXACTLY -- comptage exact sur les 2 équipes confondues", async () => {
    seed("stats_box_scores", [
      { game_id: GAME_ID, team_id: NBA_TEAM_A, technical_fouls: 1 },
      { game_id: GAME_ID, team_id: 999, technical_fouls: 1 },
      { game_id: GAME_ID, team_id: 999, technical_fouls: 0 },
    ]);
    seed("bets", [betRow({ id: "bet1" })]); // total=2, EXACTLY 2.

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it.each([
    ["AT_LEAST", 2, 3, "WON"], ["MORE_THAN", 2, 2, "LOST"], ["FEWER_THAN", 3, 2, "WON"],
  ] as const)("%s (seuil %d, total %d) -> %s", async (relation, threshold, total, expected) => {
    seed("stats_box_scores", [{ game_id: GAME_ID, team_id: NBA_TEAM_A, technical_fouls: total }]);
    seed("bets", [betRow({ id: "betX", structured_threshold: threshold, structured_technical_fouls_count: { scope: "MATCH", count_relation: relation } })]);

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.resolved).toEqual([{ betId: "betX", outcome: expected }]);
  });
});

describe("resolveCalculableTechnicalFoulsCountBets — scope équipe précise", () => {
  it("filtre par team_id résolu, ignore l'autre équipe", async () => {
    seed("stats_box_scores", [
      { game_id: GAME_ID, team_id: NBA_TEAM_A, technical_fouls: 2 },
      { game_id: GAME_ID, team_id: 999, technical_fouls: 5 }, // autre équipe -- ne doit pas compter.
    ]);
    seed("bets", [
      betRow({
        id: "bet2", structured_team_id: "TEAM_A",
        structured_technical_fouls_count: { scope: "team1", count_relation: "EXACTLY" },
      }),
    ]); // total équipe = 2, EXACTLY 2.

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "WON" }]);
  });

  it("équipe NBA correspondante introuvable -> SKIPPED", async () => {
    seed("teams", [{ id: "TEAM_A", abbreviation: null }]);
    seed("bets", [
      betRow({ id: "bet3", structured_team_id: "TEAM_A", structured_technical_fouls_count: { scope: "team1", count_relation: "EXACTLY" } }),
    ]);

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "équipe NBA correspondante introuvable" }]);
  });
});

describe("resolveCalculableTechnicalFoulsCountBets — garde-fous", () => {
  it("structuré manquant (seuil null) -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet4", structured_threshold: null })]);

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "comptage fautes techniques structuré manquant" }]);
  });

  it("pas encore de stats synchronisées -> SKIPPED", async () => {
    seed("stats_box_scores", []);
    seed("bets", [betRow({ id: "bet5" })]);

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "pas encore de stats synchronisées pour ce match" }]);
  });

  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet6" })]);

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("stats_box_scores", [{ game_id: GAME_ID, team_id: NBA_TEAM_A, technical_fouls: 2 }]); // trancherait WON.
    seed("bets", [betRow({ id: "bet7" })]);
    seed("correction_requests", [{ target_bet_id: "bet7", status: "PENDING" }]);

    const summary = await resolveCalculableTechnicalFoulsCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet7")?.status).toBe("VALIDATED");
  });
});
