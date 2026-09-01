// Test d'ORCHESTRATION de resolveCalculableBlockOnPlayerBets() ("X réalise
// au moins 1 contre SUR Y" -- stats_block_events, 1 ligne PAR ÉVÉNEMENT).
// Nouveau par rapport aux 13 fichiers précédents : ce resolver utilise
// `.select("id", { count: "exact", head: true })` (comptage seul, pas de
// lignes) -- le faux Supabase ci-dessous ajoute ce mode spécifiquement
// pour ce fichier.
//
// 14e et DERNIÈRE des 14 orchestrations de resolveCalculableBets.ts
// (Cadrage/Suivi/BILAN_GLOBAL_01_09_2026.md) -- clôt le lot "fiabilité &
// QA" sur ce fichier (les 14 resolvers + les fonctions pures sont
// désormais tous couverts).

import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private op: "select" | "update" = "select";
  private patch: Row | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";
  private countMode = false;

  constructor(private store: Row[]) {}

  select(cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    void cols;
    if (opts?.count) this.countMode = true;
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
    if (this.countMode) {
      // Comportement Supabase réel : `count` est toujours un NOMBRE (0 si
      // aucune ligne ne correspond), jamais `null` sauf en cas d'erreur
      // réseau/requête -- ce faux Supabase ne simule pas d'erreur, donc la
      // branche `matchEventCount === null` du code réel reste un garde
      // défensif jamais atteint par ces tests (même famille que les
      // branches "pré-filtrées côté requête" documentées dans les fichiers
      // précédents).
      result = { data: null, error: null, count: rows.length };
    } else if (this.op === "update") {
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

const { resolveCalculableBlockOnPlayerBets } = await import("./resolveCalculableBets");

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
    structured_block_on_player: { blocker_player_id: 301, victim_player_id: 401 },
    validated_difficulty: 3,
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
});

describe("resolveCalculableBlockOnPlayerBets — cas nominal", () => {
  it("au moins un événement (blocker, victim) correspondant -> WON", async () => {
    seed("stats_block_events", [
      { game_id: GAME_ID, blocker_player_id: 301, victim_player_id: 401 },
      { game_id: GAME_ID, blocker_player_id: 999, victim_player_id: 888 }, // autre paire -- ne doit pas compter pour celle-ci.
    ]);
    seed("bets", [betRow({ id: "bet1" })]);

    const summary = await resolveCalculableBlockOnPlayerBets();

    expect(summary.resolved).toEqual([{ betId: "bet1", outcome: "WON" }]);
    expect(readRow("bets", "bet1")?.points_awarded).toBe(15);
  });

  it("des événements existent pour le match mais jamais cette paire précise -> LOST (pas SKIPPED)", async () => {
    seed("stats_block_events", [{ game_id: GAME_ID, blocker_player_id: 999, victim_player_id: 888 }]);
    seed("bets", [betRow({ id: "bet2" })]);

    const summary = await resolveCalculableBlockOnPlayerBets();

    expect(summary.resolved).toEqual([{ betId: "bet2", outcome: "LOST" }]);
  });

  it("aucun événement synchronisé DU TOUT pour ce match -> LOST aussi (count=0, pas null -- garde défensif non atteint en pratique)", async () => {
    seed("stats_block_events", []);
    seed("bets", [betRow({ id: "bet3" })]);

    const summary = await resolveCalculableBlockOnPlayerBets();

    expect(summary.resolved).toEqual([{ betId: "bet3", outcome: "LOST" }]);
  });
});

describe("resolveCalculableBlockOnPlayerBets — garde-fous", () => {
  it("match pas encore terminé -> SKIPPED", async () => {
    seed("matches", [{ id: "m1", status: "SCHEDULED" }]);
    seed("bets", [betRow({ id: "bet4" })]);

    const summary = await resolveCalculableBlockOnPlayerBets();

    expect(summary.skipped).toEqual([{ betId: "bet4", reason: "match pas encore terminé" }]);
  });

  it("match NBA correspondant introuvable -> SKIPPED", async () => {
    seed("matches", [{ id: "m5", status: "FINISHED", home_team_id: null, away_team_id: null, scheduled_at: null }]);
    seed("bets", [betRow({ id: "bet5", match_id: "m5" })]);

    const summary = await resolveCalculableBlockOnPlayerBets();

    expect(summary.skipped).toEqual([{ betId: "bet5", reason: "match NBA correspondant introuvable" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même tranchable", async () => {
    seed("stats_block_events", [{ game_id: GAME_ID, blocker_player_id: 301, victim_player_id: 401 }]); // trancherait WON.
    seed("bets", [betRow({ id: "bet6" })]);
    seed("correction_requests", [{ target_bet_id: "bet6", status: "PENDING" }]);

    const summary = await resolveCalculableBlockOnPlayerBets();

    expect(summary.skipped).toEqual([{ betId: "bet6", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "bet6")?.status).toBe("VALIDATED");
  });
});
