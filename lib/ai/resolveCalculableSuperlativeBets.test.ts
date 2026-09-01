// Test d'ORCHESTRATION de resolveCalculableSuperlativeBets() ("X marque
// plus de {stat} que TOUT AUTRE joueur du match" -- bassin = les 2
// équipes, aucun filtre team_id/player_ids). Un DNP réel (absent du box
// score, y compris le joueur VISÉ) est traité comme ZERO_BOX_ROW. Même
// faux Supabase que les fichiers précédents.
//
// 11e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableSuperlativeBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";

function boxScoreRow(overrides: Row): Row {
  return {
    game_id: GAME_ID, player_id: null, minutes: "30:00",
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0, plus_minus: 0,
    ...overrides,
  };
}

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_player_id: 201,
    structured_superlative: { stat: "pts" },
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
});

describe("resolveCalculableSuperlativeBets — comparaison stricte au reste du match", () => {
  it("le joueur visé domine STRICTEMENT tous les autres -> WON", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ player_id: 201, pts: 35 }),
      boxScoreRow({ player_id: 202, pts: 28 }),
      boxScoreRow({ player_id: 203, pts: 20 }),
    ]);
    seed("bets", [betRow({ id: "bet1" })]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("égalité avec un autre joueur -> LOST (convention stricte, comme computeOutcome)", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ player_id: 201, pts: 30 }),
      boxScoreRow({ player_id: 202, pts: 30 }), // égalité exacte.
    ]);
    seed("bets", [betRow({ id: "bet2" })]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "LOST" }]);
  });

  it("joueur visé absent du box score (DNP réel) -> traité comme 0, LOST dès qu'un autre joueur a marqué", async () => {
    seed("stats_box_scores", [boxScoreRow({ player_id: 202, pts: 10 })]); // 201 absent.
    seed("bets", [betRow({ id: "bet3" })]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.resolved).toEqual([{ betId: "bet3", outcome: "LOST" }]);
  });
});

describe("resolveCalculableSuperlativeBets — garde-fous", () => {
  it("player_id manquant -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet4", structured_player_id: null })]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "superlatif structuré manquant" }]);
  });

  it("pas encore de stats synchronisées pour ce match -> SKIPPED", async () => {
    seed("stats_box_scores", []);
    seed("bets", [betRow({ id: "bet5" })]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "pas encore de stats synchronisées pour ce match" }]);
  });

  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet6" })]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("stats_box_scores", [boxScoreRow({ player_id: 201, pts: 35 })]); // trancherait WON.
    seed("bets", [betRow({ id: "bet7" })]);
    seed("correction_requests", [{ target_bet_id: "bet7", status: "PENDING" }]);

    const summary = await resolveCalculableSuperlativeBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet7")?.status).toBe("VALIDATED");
  });
});
