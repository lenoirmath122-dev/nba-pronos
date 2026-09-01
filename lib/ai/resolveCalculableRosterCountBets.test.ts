// Test d'ORCHESTRATION de resolveCalculableRosterCountBets() (paris
// "comptage roster-wide" -- N joueurs d'un bassin remplissant une
// condition). Distinction clé face à resolveCalculableComboBets : un
// joueur du bassin ABSENT du box score est un DNP réel et compte comme 0
// PARTOUT (ZERO_BOX_ROW), jamais comme "donnée manquante" -- documenté en
// commentaire dans le code, vérifié explicitement ci-dessous. Même faux
// Supabase que les fichiers précédents.
//
// 10e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private op: "select" | "update" = "select";
  private patch: Row | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private limitN: number | null = null;

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
  limit(n: number) {
    this.limitN = n;
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
    const rows = this.store.filter((r) => this.filters.every((f) => f(r)));
    return this.limitN !== null ? rows.slice(0, this.limitN) : rows;
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

const { resolveCalculableRosterCountBets } = await import("./resolveCalculableBets");

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
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0, plus_minus: 0, technical_fouls: 0,
    ...overrides,
  };
}

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_stat: "pts",
    structured_roster_count: {
      scope: "MATCH", pool: "ALL", count_relation: "AT_LEAST", min_players: 1,
      player_ids: [201, 202, 203],
    },
    structured_threshold: 15,
    structured_comparison: "OVER",
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
  // 201 remplit la condition (20>15), 202 non (10<=15), 203 est un DNP réel
  // -- AUCUNE ligne stats_box_scores pour lui (pas juste des zéros écrits).
  seed("stats_box_scores", [
    boxScoreRow({ player_id: 201, pts: 20 }),
    boxScoreRow({ player_id: 202, pts: 10 }),
  ]);
});

describe("resolveCalculableRosterCountBets — comptage et relations", () => {
  it("un joueur du bassin absent du box score compte comme 0 (DNP réel), PAS une donnée manquante", async () => {
    // Si le DNP faisait échouer la résolution, ce test SKIPPERAIT au lieu
    // de résoudre -- count=1 (seul 201 remplit la condition) prouve que 203
    // a bien été traité comme ZERO_BOX_ROW plutôt que bloquant.
    seed("bets", [betRow({ id: "bet1" })]); // AT_LEAST 1 -> 1 >= 1 -> WON.

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("MORE_THAN -- count strictement supérieur exigé", async () => {
    seed("bets", [
      betRow({ id: "bet2", structured_roster_count: { scope: "MATCH", pool: "ALL", count_relation: "MORE_THAN", min_players: 1, player_ids: [201, 202, 203] } }),
    ]); // count=1, pas > 1.

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "LOST" }]);
  });

  it("FEWER_THAN -- count strictement inférieur exigé", async () => {
    seed("bets", [
      betRow({ id: "bet3", structured_roster_count: { scope: "MATCH", pool: "ALL", count_relation: "FEWER_THAN", min_players: 2, player_ids: [201, 202, 203] } }),
    ]); // count=1 < 2.

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.resolved).toEqual([{ betId: "bet3", outcome: "WON" }]);
  });
});

describe("resolveCalculableRosterCountBets — garde-fous", () => {
  it("bassin vide -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet4", structured_roster_count: { scope: "MATCH", pool: "ALL", count_relation: "AT_LEAST", min_players: 1, player_ids: [] } })]);

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "aucun joueur dans le bassin structuré" }]);
  });

  it("seuil/comparaison manquant -> SKIPPED (incomplete dès le 1er joueur)", async () => {
    seed("bets", [betRow({ id: "bet5", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "seuil/comparaison manquant pour ce comptage roster-wide" }]);
  });

  it("stat manquante -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet6", structured_stat: null })]);

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "comptage roster-wide structuré manquant" }]);
  });

  it("aucune stats_box_scores DU TOUT pour ce match -> SKIPPED (distinct des DNP individuels)", async () => {
    seed("stats_box_scores", []); // rien, même pas 201/202 -- vraie non-synchro, pas des DNP.
    seed("bets", [betRow({ id: "bet7" })]);

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "pas encore de stats synchronisées pour ce match" }]);
  });

  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet8" })]);

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet8", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("bets", [betRow({ id: "bet9" })]); // trancherait WON.
    seed("correction_requests", [{ target_bet_id: "bet9", status: "PENDING" }]);

    const summary = await resolveCalculableRosterCountBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet9")?.status).toBe("VALIDATED");
  });
});
