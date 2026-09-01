// Test d'ORCHESTRATION de resolveCalculableLastBasketBets() ("X inscrit le
// dernier panier du match" -- stats_matchs.last_basket_player_id, agrégé à
// la synchro). Même faux Supabase que les fichiers précédents.
//
// 14e et dernière des 14 orchestrations de resolveCalculableBets.ts
// (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableLastBasketBets } = await import("./resolveCalculableBets");

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
    structured_player_id: 201,
    structured_last_basket: true,
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
});

describe("resolveCalculableLastBasketBets — cas nominal", () => {
  it("le joueur visé a bien marqué le dernier panier -> WON", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, last_basket_player_id: 201 }]);
    seed("bets", [betRow({ id: "bet1" })]);

    const summary = await resolveCalculableLastBasketBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("un autre joueur a marqué le dernier panier -> LOST", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, last_basket_player_id: 202 }]);
    seed("bets", [betRow({ id: "bet2" })]);

    const summary = await resolveCalculableLastBasketBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "LOST" }]);
  });

  it("signal pas encore synchronisé (last_basket_player_id NULL) -> SKIPPED", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, last_basket_player_id: null }]);
    seed("bets", [betRow({ id: "bet3" })]);

    const summary = await resolveCalculableLastBasketBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "pas encore de stats synchronisées pour ce match" }]);
  });
});

describe("resolveCalculableLastBasketBets — garde d'éligibilité à message partagé", () => {
  // Une seule condition regroupe 2 causes distinctes (match_id/player_id
  // manquant OU match pas terminé) avec un message CHOISI par ternaire
  // selon le sous-cas -- vérifie que le bon message sort dans chacun.
  it("match terminé mais player_id manquant -> 'dernier panier structuré manquant'", async () => {
    seed("bets", [betRow({ id: "bet4", structured_player_id: null })]);

    const summary = await resolveCalculableLastBasketBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "dernier panier structuré manquant" }]);
  });

  it("match pas terminé -> 'match pas encore terminé', même avec player_id présent", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet5" })]);

    const summary = await resolveCalculableLastBasketBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "match pas encore terminé" }]);
  });
});

describe("resolveCalculableLastBasketBets — autres garde-fous", () => {
  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("stats_matchs", [{ game_id: GAME_ID, last_basket_player_id: 201 }]); // trancherait WON.
    seed("bets", [betRow({ id: "bet6" })]);
    seed("correction_requests", [{ target_bet_id: "bet6", status: "PENDING" }]);

    const summary = await resolveCalculableLastBasketBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet6")?.status).toBe("VALIDATED");
  });
});
