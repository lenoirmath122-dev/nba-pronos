// Test d'ORCHESTRATION de resolveCalculableRosterSplitBets() (paris "5
// majeur"/"banc" -- STARTERS_SUM/BENCH_SUM/STARTERS_SHARE, colonne
// position="F"/"C"/"G" = titulaire, "" = remplaçant). Même faux Supabase
// que les fichiers précédents.
//
// 9e des 14 orchestrations (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md).

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

const { resolveCalculableRosterSplitBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

const GAME_ID = "0022500001";
const NBA_TEAM_A = 1610612738;

function boxScoreRow(overrides: Row): Row {
  return {
    game_id: GAME_ID, team_id: NBA_TEAM_A, player_id: null, position: "",
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0, oreb: 0,
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, plus_minus: 0, technical_fouls: 0,
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
    structured_roster_split: { kind: "STARTERS_SUM", team_id: "TEAM_A", stat: "pts" },
    structured_threshold: 30,
    structured_comparison: "OVER",
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
  seed("stats_box_scores", [
    boxScoreRow({ player_id: 201, position: "F", pts: 20 }), // titulaire.
    boxScoreRow({ player_id: 202, position: "C", pts: 15 }), // titulaire.
    boxScoreRow({ player_id: 203, position: "", pts: 10 }), // banc.
    boxScoreRow({ player_id: 204, position: "", pts: 8 }), // banc.
  ]); // total équipe = 53, titulaires = 35, banc = 18.
});

describe("resolveCalculableRosterSplitBets — STARTERS_SUM / BENCH_SUM", () => {
  it("STARTERS_SUM -- somme uniquement les lignes avec position renseignée", async () => {
    seed("bets", [betRow({ id: "bet1" })]); // 35 > 30.

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("BENCH_SUM -- somme uniquement les lignes SANS position (remplaçants)", async () => {
    seed("bets", [
      betRow({
        id: "bet2", structured_threshold: 15,
        structured_roster_split: { kind: "BENCH_SUM", team_id: "TEAM_A", stat: "pts" },
      }),
    ]); // 18 > 15.

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "WON" }]);
  });
});

describe("resolveCalculableRosterSplitBets — STARTERS_SHARE", () => {
  it("fraction des points d'équipe marqués par les titulaires", async () => {
    seed("bets", [
      betRow({
        id: "bet3", structured_threshold: 0.6,
        structured_roster_split: { kind: "STARTERS_SHARE", team_id: "TEAM_A", stat: "pts" },
      }),
    ]); // 35/53 ~ 0.660 > 0.6.

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.resolved).toEqual([{ betId: "bet3", outcome: "WON" }]);
  });

  it("total d'équipe à 0 -> part indéterminée, SKIPPED (pas une division par zéro silencieuse)", async () => {
    seed("stats_box_scores", [boxScoreRow({ player_id: 201, position: "F", pts: 0 })]);
    seed("bets", [
      betRow({
        id: "bet4", structured_threshold: 0.5,
        structured_roster_split: { kind: "STARTERS_SHARE", team_id: "TEAM_A", stat: "pts" },
      }),
    ]);

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "seuil/comparaison manquant pour ce pari 5 majeur/banc" }]);
  });
});

describe("resolveCalculableRosterSplitBets — garde-fous d'éligibilité", () => {
  it("stat manquante -> SKIPPED", async () => {
    seed("bets", [betRow({ id: "bet5", structured_stat: null })]);

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "5 majeur/banc structuré manquant" }]);
  });

  it("équipe NBA correspondante introuvable -> SKIPPED", async () => {
    seed("teams", [{ id: "TEAM_A", abbreviation: null }]);
    seed("bets", [betRow({ id: "bet6" })]);

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "équipe NBA correspondante introuvable" }]);
  });

  it("pas encore de stats synchronisées pour cette équipe -> SKIPPED", async () => {
    seed("stats_box_scores", []);
    seed("bets", [betRow({ id: "bet7" })]);

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.skipped).toEqual([{ betId: "bet7", reason: "pas encore de stats synchronisées pour cette équipe" }]);
  });

  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet8" })]);

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.skipped).toEqual([{ betId: "bet8", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("bets", [betRow({ id: "bet9" })]); // trancherait WON.
    seed("correction_requests", [{ target_bet_id: "bet9", status: "PENDING" }]);

    const summary = await resolveCalculableRosterSplitBets();

    expect(summary.skipped).toEqual([{ betId: "bet9", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet9")?.status).toBe("VALIDATED");
  });
});
