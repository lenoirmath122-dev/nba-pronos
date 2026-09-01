// Test d'ORCHESTRATION de resolveCalculableTeamStatBets() — 2 formes du
// même mécanisme : "{stat}" (équipe précise, structured_team_id renseigné,
// resolveNbaTeamId) et "total_{stat}" (combiné, toutes les lignes du
// match), plus le cas particulier des stats en pourcentage (ft/fg/fg3,
// makes/attempts sommés séparément). Même faux Supabase que les fichiers
// précédents.
//
// 6e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableTeamStatBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";
const NBA_TEAM_A = 1610612738; // Boston.
const NBA_TEAM_B = 1610612752; // New York.

function boxScoreRow(overrides: Row): Row {
  return {
    game_id: GAME_ID, team_id: null,
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0, oreb: 0, fga: 0,
    ftm: 0, fta: 0, fgm: 0, fga2: 0, fg3m2: 0, fg3a: 0,
    ...overrides,
  };
}

function betRow(overrides: Row): Row {
  return {
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_stat: "reb",
    structured_team_id: "TEAM_A",
    structured_threshold: 40,
    structured_comparison: "OVER",
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: "2026-04-15T23:00:00.000Z" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
  seed("teams", [{ id: "TEAM_A", abbreviation: "BOS" }, { id: "TEAM_B", abbreviation: "NYK" }]);
  seed("stats_equipes", [{ team_id: NBA_TEAM_A, tricode: "BOS" }, { team_id: NBA_TEAM_B, tricode: "NYK" }]);
});

describe("resolveCalculableTeamStatBets — forme équipe précise", () => {
  it("stat comptée sommée sur les lignes de l'équipe visée uniquement -> WON", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ team_id: NBA_TEAM_A, reb: 22 }),
      boxScoreRow({ team_id: NBA_TEAM_A, reb: 20 }),
      boxScoreRow({ team_id: NBA_TEAM_B, reb: 50 }), // autre équipe -- ne doit pas compter.
    ]);
    seed("bets", [betRow({ id: "bet1" })]); // 22+20=42 > 40.

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("stat en pourcentage (fg) -- makes/attempts sommés séparément puis divisés", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ team_id: NBA_TEAM_A, fgm: 20, fga: 40 }),
      boxScoreRow({ team_id: NBA_TEAM_A, fgm: 10, fga: 20 }), // total 30/60 = 50%.
    ]);
    seed("bets", [betRow({ id: "bet2", structured_stat: "fg", structured_threshold: 0.45 })]); // 50% > 45%.

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "WON" }]);
  });

  it("équipe manquante (forme précise sans structured_team_id) -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet3", structured_team_id: null })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "équipe manquante" }]);
  });

  it("équipe NBA correspondante introuvable (pas de tricode résolu) -> SKIPPED", async () => {
    seed("teams", [{ id: "TEAM_A", abbreviation: null }]); // pas d'abréviation -> résolution impossible.
    seed("bets", [betRow({ id: "bet4" })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "équipe NBA correspondante introuvable" }]);
  });

  it("pas encore de stats synchronisées pour cette équipe -> SKIPPED", async () => {
    seed("stats_box_scores", []); // aucune ligne.
    seed("bets", [betRow({ id: "bet5" })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "pas encore de stats synchronisées pour cette équipe" }]);
  });
});

describe("resolveCalculableTeamStatBets — forme combinée (total_)", () => {
  it("somme TOUTES les lignes du match, les 2 équipes confondues -> WON", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ team_id: NBA_TEAM_A, reb: 22 }),
      boxScoreRow({ team_id: NBA_TEAM_B, reb: 25 }),
    ]);
    seed("bets", [betRow({ id: "bet6", structured_stat: "total_reb", structured_team_id: null, structured_threshold: 40 })]); // 22+25=47>40.

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.resolved).toEqual([{ betId: "bet6", outcome: "WON" }]);
  });

  it("forme combinée + stat en pourcentage -> SKIPPED (jamais produit par la structuration, garde explicite)", async () => {
    seed("bets", [betRow({ id: "bet7", structured_stat: "total_fg", structured_team_id: null, structured_threshold: 0.45 })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "forme combinée non supportée pour un pourcentage" }]);
  });

  it("pas encore de stats synchronisées pour le match -> SKIPPED", async () => {
    seed("stats_box_scores", []);
    seed("bets", [betRow({ id: "bet8", structured_stat: "total_reb", structured_team_id: null, structured_threshold: 40 })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet8", reason: "pas encore de stats synchronisées pour ce match" }]);
  });
});

describe("resolveCalculableTeamStatBets — garde-fous d'éligibilité", () => {
  it("seuil ou comparaison manquant -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet9", structured_threshold: null })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "seuil/comparaison manquant" }]);
  });

  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet10" })]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet10", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("stats_box_scores", [boxScoreRow({ team_id: NBA_TEAM_A, reb: 45 })]); // trancherait WON.
    seed("bets", [betRow({ id: "bet11" })]);
    seed("correction_requests", [{ target_bet_id: "bet11", status: "PENDING" }]);

    const summary = await resolveCalculableTeamStatBets();

    expect(summary.skipped).toEqual([{ betId: "bet11", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet11")?.status).toBe("VALIDATED");
  });
});
