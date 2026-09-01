// Test d'ORCHESTRATION de resolveCalculableSeriesBets() (scope SERIES,
// sémantique "au moins une fois sur la série" — pièce (e) du chantier paris
// série, 23/08/2026). Même faux Supabase en mémoire que
// resolveCalculableComboBets.test.ts (voir ce fichier pour le détail de la
// technique) — logique distincte du scope MATCH : parcourt PLUSIEURS
// matchs FINISHED d'une série, s'arrête au 1er hit, et ne résout LOST que
// si la série ENTIÈRE est terminée ET que toutes les données sont là.
//
// 3e des 14 orchestrations de resolveCalculableBets.ts (voir Cadrage/Suivi/
// BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableSeriesBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

function boxScoreRow(overrides: Row): Row {
  return {
    player_id: null,
    minutes: "30:00",
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0,
    plus_minus: 0, technical_fouls: 0,
    ...overrides,
  };
}

function betRow(overrides: Row): Row {
  return {
    scope: "SERIES",
    is_calculable: true,
    status: "VALIDATED",
    series_id: "s1",
    structured_player_id: 201,
    structured_stat: "pts",
    structured_threshold: 20,
    structured_comparison: "OVER",
    validated_difficulty: 3, // barème difficulté 3 -> 15.
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
});

describe("resolveCalculableSeriesBets — hit dès le 1er match, arrêt immédiat", () => {
  it("stat atteinte au match 1 -> WON, jamais besoin des données du match 2 (break sur hit)", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", [
      { id: "m1", series_id: "s1", status: "FINISHED" },
      { id: "m2", series_id: "s1", status: "FINISHED" }, // volontairement SANS mapping/stats -- ne doit jamais être interrogé.
    ]);
    seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
    seed("stats_box_scores", [boxScoreRow({ game_id: "G1", player_id: 201, pts: 30 })]); // > 20.
    seed("bets", [betRow({ id: "bet1" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });
});

describe("resolveCalculableSeriesBets — raté sur un match, hit sur un autre", () => {
  it("le raté du match 1 n'empêche pas un hit trouvé au match 2 -> WON", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", [
      { id: "m1", series_id: "s1", status: "FINISHED" },
      { id: "m2", series_id: "s1", status: "FINISHED" },
    ]);
    seed("entity_mappings", [
      { entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" },
      { entity_type: "MATCH", source_type: "NBA_API", internal_id: "m2", source_ref: "G2" },
    ]);
    seed("stats_box_scores", [
      boxScoreRow({ game_id: "G1", player_id: 201, pts: 10 }), // raté (<= 20).
      boxScoreRow({ game_id: "G2", player_id: 201, pts: 25 }), // hit.
    ]);
    seed("bets", [betRow({ id: "bet2" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "WON" }]);
  });
});

describe("resolveCalculableSeriesBets — jamais LOST avant la fin de la série", () => {
  it("aucun hit, série encore IN_PROGRESS -> SKIPPED, pas résolu en LOST prématurément", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", [{ id: "m1", series_id: "s1", status: "FINISHED" }]);
    seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
    seed("stats_box_scores", [boxScoreRow({ game_id: "G1", player_id: 201, pts: 10 })]); // raté.
    seed("bets", [betRow({ id: "bet3" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "série pas encore terminée, pas encore de hit" }]);
    expect(readRow("bets", "bet3")?.status).toBe("VALIDATED");
  });
});

describe("resolveCalculableSeriesBets — série terminée, sans hit", () => {
  it("données manquantes sur un match joué -> SKIPPED, jamais résolu en LOST à tort", async () => {
    seed("series", [{ id: "s1", official_status: "FINISHED" }]);
    seed("matches", [{ id: "m1", series_id: "s1", status: "FINISHED" }]);
    seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
    // Aucune ligne stats_box_scores pour ce joueur sur ce match -- données pas encore synchronisées.
    seed("bets", [betRow({ id: "bet4" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "données manquantes pour au moins un match de la série" }]);
  });

  it("zéro match FINISHED trouvé pour la série -> SKIPPED, même raison", async () => {
    seed("series", [{ id: "s1", official_status: "FINISHED" }]);
    seed("matches", []); // aucun match rattaché à s1.
    seed("bets", [betRow({ id: "bet5" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "données manquantes pour au moins un match de la série" }]);
  });

  it("toutes les données présentes, jamais atteint -> LOST", async () => {
    seed("series", [{ id: "s1", official_status: "FINISHED" }]);
    seed("matches", [{ id: "m1", series_id: "s1", status: "FINISHED" }]);
    seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
    seed("stats_box_scores", [boxScoreRow({ game_id: "G1", player_id: 201, pts: 10 })]); // raté, mais donnée bien là.
    seed("bets", [betRow({ id: "bet6" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.resolved).toEqual([{ betId: "bet6", outcome: "LOST" }]);
  });
});

describe("resolveCalculableSeriesBets — stat sans seuil (dd/td/tech)", () => {
  it("threshold/comparison null n'est PAS un blocage pour une stat NO_THRESHOLD (dd)", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", [{ id: "m1", series_id: "s1", status: "FINISHED" }]);
    seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
    seed("stats_box_scores", [boxScoreRow({ game_id: "G1", player_id: 201, pts: 25, reb: 11 })]); // double-double réel.
    seed("bets", [betRow({ id: "bet7", structured_stat: "dd", structured_threshold: null, structured_comparison: null })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.resolved).toEqual([{ betId: "bet7", outcome: "WON" }]);
  });
});

describe("resolveCalculableSeriesBets — garde-fous d'éligibilité", () => {
  it("stat manquant -> SKIPPED", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", []);
    seed("bets", [betRow({ id: "bet8", structured_stat: null })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.skipped).toEqual([{ betId: "bet8", reason: "player_id ou stat manquant" }]);
  });

  it("seuil ou comparaison manquant (stat À seuil) -> SKIPPED", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", []);
    seed("bets", [betRow({ id: "bet9", structured_threshold: null })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "seuil/comparaison manquant" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("series", [{ id: "s1", official_status: "IN_PROGRESS" }]);
    seed("matches", [{ id: "m1", series_id: "s1", status: "FINISHED" }]);
    seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
    seed("stats_box_scores", [boxScoreRow({ game_id: "G1", player_id: 201, pts: 30 })]); // trancherait WON.
    seed("correction_requests", [{ target_bet_id: "bet10", status: "PENDING" }]);
    seed("bets", [betRow({ id: "bet10" })]);

    const summary = await resolveCalculableSeriesBets();

    expect(summary.skipped).toEqual([{ betId: "bet10", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet10")?.status).toBe("VALIDATED");
  });
});
