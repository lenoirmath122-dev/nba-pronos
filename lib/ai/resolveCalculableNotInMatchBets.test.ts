// Test de resolveCalculableNotInMatchBets() (p3-14, 04/10/2026) : pari
// JOUEUR simple resté sans structured_player_id (joueur jugé absent du
// match par l'IA). Même faux Supabase en mémoire que
// resolveCalculableSeriesBets.test.ts, avec `.is()` en plus.

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
  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }
  limit(n: number) {
    void n; // le fake renvoie toutes les lignes filtrées -- isBoxScoreSynced() ne regarde que "au moins une".
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

const { resolveCalculableNotInMatchBets, matchPlayerByName, normalizePlayerName, NOT_IN_MATCH_RESOLUTION_REASON } =
  await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

function boxScoreRow(overrides: Row): Row {
  return {
    game_id: "G1",
    player_id: null,
    minutes: "30:00",
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0,
    plus_minus: 0, technical_fouls: 0, tov: 0,
    ...overrides,
  };
}

function betRow(overrides: Row): Row {
  return {
    scope: "MATCH",
    is_calculable: true,
    status: "VALIDATED",
    match_id: "m1",
    structured_player_id: null,
    structured_player_name: "Jalen Brunson",
    structured_stat: "pts",
    structured_threshold: 15,
    structured_comparison: "OVER",
    structured_team_id: null,
    structured_duel: null,
    structured_combo: null,
    structured_period: null,
    structured_roster_split: null,
    structured_roster_count: null,
    structured_superlative: null,
    structured_technical_fouls_count: null,
    structured_last_basket: null,
    structured_block_on_player: null,
    validated_difficulty: 5,
    ...overrides,
  };
}

// LAL–GSW : feuille de match sans Brunson.
function seedFinishedMatch() {
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: "G1" }]);
  seed("stats_box_scores", [
    boxScoreRow({ player_id: 2544, pts: 28 }),
    boxScoreRow({ player_id: 201939, pts: 31 }),
  ]);
  seed("stats_joueurs", [
    { player_id: 2544, first_name: "LeBron", family_name: "James" },
    { player_id: 201939, first_name: "Stephen", family_name: "Curry" },
    { player_id: 1628973, first_name: "Jalen", family_name: "Brunson" },
  ]);
}

beforeEach(() => {
  fake.db = {};
});

describe("normalizePlayerName / matchPlayerByName", () => {
  it("ignore accents, ponctuation et suffixes", () => {
    expect(normalizePlayerName("Luka Dončić")).toBe("luka doncic");
    expect(normalizePlayerName("Michael Porter Jr.")).toBe("michael porter");
    expect(normalizePlayerName("Shai Gilgeous-Alexander")).toBe("shai gilgeous alexander");
  });

  it("nom complet trouvé -> FOUND, nom de famille seul -> AMBIGUOUS, sinon ABSENT", () => {
    const players = [
      { player_id: 1, first_name: "Stephen", family_name: "Curry" },
      { player_id: 2, first_name: "Michael", family_name: "Porter Jr." },
    ];
    expect(matchPlayerByName("Steph Curry", players)).toEqual({ kind: "AMBIGUOUS" });
    expect(matchPlayerByName("Stephen Curry", players)).toEqual({ kind: "FOUND", playerId: 1 });
    expect(matchPlayerByName("Michael Porter Jr.", players)).toEqual({ kind: "FOUND", playerId: 2 });
    expect(matchPlayerByName("Jalen Brunson", players)).toEqual({ kind: "ABSENT" });
  });
});

describe("resolveCalculableNotInMatchBets", () => {
  it("joueur absent de la feuille du match terminé -> LOST avec le motif dédié (cas Brunson de l'alpha)", async () => {
    seedFinishedMatch();
    seed("bets", [betRow({ id: "bet1" })]);

    const summary = await resolveCalculableNotInMatchBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "LOST" }]);
    expect(readRow("bets", "bet1")?.status).toBe("LOST");
    expect(readRow("bets", "bet1")?.resolution_reason).toBe(NOT_IN_MATCH_RESOLUTION_REASON);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(0);
  });

  it("l'IA s'était trompée, le joueur est sur la feuille -> résolu sur ses vraies stats, id renseigné", async () => {
    seedFinishedMatch();
    seed("bets", [betRow({ id: "bet2", structured_player_name: "Stephen Curry", structured_threshold: 30 })]);

    const summary = await resolveCalculableNotInMatchBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "WON" }]);
    expect(readRow("bets", "bet2")?.structured_player_id).toBe(201939);
  });

  it("nom de famille seul sur la feuille -> laissé à l'admin, jamais LOST à tort", async () => {
    seedFinishedMatch();
    seed("bets", [betRow({ id: "bet3", structured_player_name: "Steph Curry" })]);

    const summary = await resolveCalculableNotInMatchBets();

    expect(summary.resolved).toEqual([]);
    expect(summary.skipped[0]?.betId).toBe("bet3");
    expect(readRow("bets", "bet3")?.status).toBe("VALIDATED");
  });

  it("box score pas encore importé -> attend la prochaine passe", async () => {
    seedFinishedMatch();
    fake.db.stats_box_scores = [];
    seed("bets", [betRow({ id: "bet4" })]);

    const summary = await resolveCalculableNotInMatchBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "box score du match pas encore importé" }]);
    expect(readRow("bets", "bet4")?.status).toBe("VALIDATED");
  });

  it("match pas terminé -> rien n'est tranché", async () => {
    seedFinishedMatch();
    fake.db.matches = [{ id: "m1", status: "SCHEDULED" }];
    seed("bets", [betRow({ id: "bet5" })]);

    const summary = await resolveCalculableNotInMatchBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "match pas encore terminé" }]);
  });

  it("ignore les autres formes (période, superlatif...) et les paris qui ont déjà un id", async () => {
    seedFinishedMatch();
    seed("bets", [
      betRow({ id: "bet6", structured_period: { period: "Q1" } }),
      betRow({ id: "bet7", structured_player_id: 1628973 }),
    ]);

    const summary = await resolveCalculableNotInMatchBets();

    expect(summary).toEqual({ resolved: [], skipped: [] });
  });
});
