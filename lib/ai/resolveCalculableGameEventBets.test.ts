// Test d'ORCHESTRATION de resolveCalculableGameEventBets() -- 3 stats
// MATCH_TOTAL sans joueur : total_timeouts (seuil), had_backcourt_turnover
// et had_buzzer_beater (probabilité directe, avec négation -- couvre
// explicitement le bug réel du 25/08/2026 : "aucun panier au buzzer"
// résolu à tort en LOST avant le correctif de négation). Même faux
// Supabase que les fichiers précédents.
//
// 12e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableGameEventBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_player_id: null,
    structured_negation: false,
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
});

describe("resolveCalculableGameEventBets — total_timeouts", () => {
  it("total (home+away) > seuil -> WON", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, home_timeouts: 4, away_timeouts: 3 }]); // total 7.
    seed("bets", [betRow({ id: "bet1", structured_stat: "total_timeouts", structured_threshold: 6, structured_comparison: "OVER" })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("seuil ou comparaison manquant -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet2", structured_stat: "total_timeouts", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.skipped).toEqual([{ betId: "bet2", reason: "seuil/comparaison manquant" }]);
  });

  it("temps morts pas encore synchronisés -> SKIPPED", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, home_timeouts: null, away_timeouts: null }]);
    seed("bets", [betRow({ id: "bet3", structured_stat: "total_timeouts", structured_threshold: 6, structured_comparison: "OVER" })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "temps morts pas encore synchronisés pour ce match" }]);
  });
});

describe("resolveCalculableGameEventBets — had_backcourt_turnover (avec négation)", () => {
  it("au moins un retour en zone -> WON (sans négation)", async () => {
    seed("stats_box_scores", [{ game_id: GAME_ID, backcourt_turnovers: 1 }, { game_id: GAME_ID, backcourt_turnovers: 0 }]);
    seed("bets", [betRow({ id: "bet4", structured_stat: "had_backcourt_turnover", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.resolved).toEqual([{ betId: "bet4", outcome: "WON" }]);
  });

  it("négation ('aucun retour en zone') sur un match SANS retour en zone -> WON", async () => {
    seed("stats_box_scores", [{ game_id: GAME_ID, backcourt_turnovers: 0 }]);
    seed("bets", [
      betRow({ id: "bet5", structured_stat: "had_backcourt_turnover", structured_threshold: null, structured_comparison: null, structured_negation: true }),
    ]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.resolved).toEqual([{ betId: "bet5", outcome: "WON" }]);
  });

  it("pas de lignes stats_box_scores -> SKIPPED", async () => {
    seed("stats_box_scores", []);
    seed("bets", [betRow({ id: "bet6", structured_stat: "had_backcourt_turnover", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "pas encore de stats synchronisées pour ce match" }]);
  });
});

describe("resolveCalculableGameEventBets — had_buzzer_beater (négation, non-régression du bug du 25/08/2026)", () => {
  it("panier marqué au buzzer -> WON (sans négation)", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, had_buzzer_beater: true }]);
    seed("bets", [betRow({ id: "bet7", structured_stat: "had_buzzer_beater", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.resolved).toEqual([{ betId: "bet7", outcome: "WON" }]);
  });

  it("'aucun panier marqué au buzzer' sur un match SANS buzzer beater -> WON (bug réel corrigé, pas LOST à tort)", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, had_buzzer_beater: false }]);
    seed("bets", [
      betRow({ id: "bet8", structured_stat: "had_buzzer_beater", structured_threshold: null, structured_comparison: null, structured_negation: true }),
    ]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.resolved).toEqual([{ betId: "bet8", outcome: "WON" }]);
  });

  it("signal pas encore synchronisé -> SKIPPED", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, had_buzzer_beater: null }]);
    seed("bets", [betRow({ id: "bet9", structured_stat: "had_buzzer_beater", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "pas encore de stats synchronisées pour ce match" }]);
  });
});

describe("resolveCalculableGameEventBets — garde-fous communs", () => {
  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet10", structured_stat: "had_buzzer_beater", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.skipped).toEqual([{ betId: "bet10", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, had_buzzer_beater: true }]); // trancherait WON.
    seed("bets", [betRow({ id: "bet11", structured_stat: "had_buzzer_beater", structured_threshold: null, structured_comparison: null })]);
    seed("correction_requests", [{ target_bet_id: "bet11", status: "PENDING" }]);

    const summary = await resolveCalculableGameEventBets();

    expect(summary.skipped).toEqual([{ betId: "bet11", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet11")?.status).toBe("VALIDATED");
  });
});
