// Test d'ORCHESTRATION de resolveCalculableBets() (scope MATCH, pari
// PLAYER simple — la fonction la plus ancienne/centrale de
// resolveCalculableBets.ts, cf. commentaire "Phase 6 bloc 1"). Même faux
// Supabase en mémoire que resolveCalculableComboBets.test.ts (jamais une
// vraie base) — voir ce fichier pour le détail de la technique.
//
// 2e des 14 orchestrations de resolveCalculableBets.ts à être testée (voir
// Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md). Beaucoup de branches sont
// structurellement identiques à resolveCalculableComboBets (match pas
// terminé, correction en attente, match NBA introuvable) — pas
// re-détaillées en commentaire ici, seules les branches SPÉCIFIQUES à ce
// resolver (player_id/stat manquant, absence de ligne stats_box_scores,
// seuil/comparaison manquant) ont un commentaire dédié.

import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private op: "select" | "update" = "select";
  private patch: Row | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(private store: Row[]) {}

  select(cols?: string) {
    void cols; // projection ignorée (fake sans colonnes).
    return this; // ne change pas l'opération -- peut suivre .update().
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

const { resolveCalculableBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";

function boxScoreRow(overrides: Row): Row {
  return {
    game_id: GAME_ID,
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
    match_id: "m1",
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    structured_player_id: 201,
    structured_stat: "pts",
    structured_threshold: 20,
    structured_comparison: "OVER",
    validated_difficulty: 3, // barème difficulté 3 -> 15 (recompute.test.ts).
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: "2026-04-15T23:00:00.000Z" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
  seed("stats_box_scores", [boxScoreRow({ player_id: 201, pts: 28 })]); // > 20 -> WON par défaut.
});

describe("resolveCalculableBets — cas nominal", () => {
  it("stat au-dessus du seuil -> WON, recomputeBet pose les points (difficulté 3 -> 15)", async () => {
    seed("bets", [betRow({ id: "bet1" })]);

    const summary = await resolveCalculableBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    const row = readRow("bets", "bet1");
    expect(row?.status).toBe("WON");
    expect(row?.points_awarded).toBe(15);
  });

  it("stat sous le seuil -> LOST", async () => {
    seed("bets", [betRow({ id: "bet2", structured_threshold: 40 })]); // 28 <= 40.

    const summary = await resolveCalculableBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "LOST" }]);
    expect(readRow("bets", "bet2")?.status).toBe("LOST");
  });
});

describe("resolveCalculableBets — données incomplètes, jamais tranché à tort", () => {
  it("stat manquant -> SKIPPED avant toute requête de stats box score", async () => {
    // structured_player_id manquant n'est PAS testable via cette voie : la
    // requête initiale filtre déjà `.not("structured_player_id", "is",
    // null)` avant la boucle -- un tel pari n'est même pas remonté par
    // Supabase, donc le garde de la boucle (`bet.structured_player_id ===
    // null`) est mort côté player_id, seul le cas `structured_stat`
    // manquant peut réellement l'atteindre.
    seed("bets", [betRow({ id: "bet3", structured_stat: null })]);

    const summary = await resolveCalculableBets();

    expect(summary.skipped).toEqual([{ betId: "bet3", reason: "player_id ou stat manquant" }]);
  });

  it("aucune ligne stats_box_scores pour ce joueur -> SKIPPED, pas résolu en LOST", async () => {
    seed("bets", [betRow({ id: "bet4", structured_player_id: 999 })]); // pas de ligne stats_box_scores pour 999.

    const summary = await resolveCalculableBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "pas de ligne stats_box_scores pour ce joueur/match" }]);
    expect(readRow("bets", "bet4")?.status).toBe("VALIDATED");
  });

  it("seuil ou comparaison manquant -> SKIPPED (computeOutcome renvoie null)", async () => {
    seed("bets", [betRow({ id: "bet5", structured_threshold: null })]);

    const summary = await resolveCalculableBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "seuil/comparaison manquant" }]);
  });
});

describe("resolveCalculableBets — garde-fous d'éligibilité (mêmes que resolveCalculableComboBets)", () => {
  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m2", status: "SCHEDULED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: null }]);
    seed("bets", [betRow({ id: "bet6", match_id: "m2" })]);

    const summary = await resolveCalculableBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("bets", [betRow({ id: "bet7" })]); // trancherait WON (28 > 20).
    seed("correction_requests", [{ target_bet_id: "bet7", status: "PENDING" }]);

    const summary = await resolveCalculableBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet7")?.status).toBe("VALIDATED");
  });
});
