// Test d'ORCHESTRATION de resolveCalculableMatchTotalBets() (paris SANS
// JOUEUR : total_points, went_to_ot) — le plus simple des resolvers, lit
// directement matches.home_score/away_score/went_to_ot (déjà synchronisés
// par le sync existant), aucune dépendance à stats_box_scores ni à
// resolveNbaGameId. Même faux Supabase que les fichiers précédents.
//
// 5e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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
  is(col: string, val: null) {
    this.filters.push((r) => (r[col] ?? null) === val);
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

const { resolveCalculableMatchTotalBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_player_id: null,
    structured_stat: "total_points",
    structured_threshold: 210,
    structured_comparison: "OVER",
    structured_negation: false,
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED", home_score: 110, away_score: 105, went_to_ot: false }]); // total=215.
});

describe("resolveCalculableMatchTotalBets — total_points", () => {
  it("total > seuil (OVER) -> WON", async () => {
    seed("bets", [betRow({ id: "bet1" })]); // 215 > 210.

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("total < seuil (UNDER) -> WON", async () => {
    seed("bets", [betRow({ id: "bet2", structured_threshold: 220, structured_comparison: "UNDER" })]); // 215 < 220.

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "WON" }]);
  });

  it("seuil ou comparaison manquant -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet3", structured_threshold: null })]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "seuil/comparaison manquant" }]);
  });

  it("score pas encore synchronisé -> SKIPPED, jamais tranché à tort", async () => {
    seed("matches", [{ id: "m1", status: "FINISHED", home_score: null, away_score: null, went_to_ot: null }]);
    seed("bets", [betRow({ id: "bet4" })]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "score du match pas encore synchronisé" }]);
  });
});

describe("resolveCalculableMatchTotalBets — went_to_ot (avec négation)", () => {
  it("le match est allé en prolongation -> WON", async () => {
    seed("matches", [{ id: "m1", status: "FINISHED", home_score: 110, away_score: 105, went_to_ot: true }]);
    seed("bets", [betRow({ id: "bet5", structured_stat: "went_to_ot", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.resolved).toEqual([{ betId: "bet5", outcome: "WON" }]);
  });

  it("négation ('pas de prolongation') inverse le résultat -- non-régression du bug had_buzzer_beater", async () => {
    seed("matches", [{ id: "m1", status: "FINISHED", home_score: 110, away_score: 105, went_to_ot: true }]);
    seed("bets", [
      betRow({
        id: "bet6", structured_stat: "went_to_ot", structured_threshold: null, structured_comparison: null,
        structured_negation: true, // "le match n'ira PAS en prolongation" -- match EST allé en OT -> LOST.
      }),
    ]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.resolved).toEqual([{ betId: "bet6", outcome: "LOST" }]);
  });

  it("signal de prolongation pas encore synchronisé (match FINISHED, went_to_ot NULL) -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "FINISHED", home_score: 110, away_score: 105, went_to_ot: null }]);
    seed("bets", [betRow({ id: "bet7", structured_stat: "went_to_ot", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "signal de prolongation pas encore synchronisé" }]);
  });
});

describe("resolveCalculableMatchTotalBets — garde-fous d'éligibilité", () => {
  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED", home_score: null, away_score: null, went_to_ot: null }]);
    seed("bets", [betRow({ id: "bet8" })]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.skipped).toEqual([{ betId: "bet8", reason: "match pas encore terminé" }]);
  });

  it("match_id manquant -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet9", match_id: null })]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "match manquant" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("bets", [betRow({ id: "bet10" })]); // trancherait WON (215 > 210).
    seed("correction_requests", [{ target_bet_id: "bet10", status: "PENDING" }]);

    const summary = await resolveCalculableMatchTotalBets();

    expect(summary.skipped).toEqual([{ betId: "bet10", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet10")?.status).toBe("VALIDATED");
  });
});
