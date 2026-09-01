// Test d'ORCHESTRATION de resolveCalculableComboBets (Cadrage/Suivi/
// BILAN_GLOBAL_01_09_2026.md, chantier fiabilité & QA, 01/09/2026) — contre
// un faux Supabase en mémoire, même technique que lib/scoring/recompute.test.ts
// (jamais une vraie base). Complète resolveCalculableBets.test.ts (fonctions
// pures, sans DB) en vérifiant le CÂBLAGE réel : lecture des paris éligibles,
// résolution du vrai match NBA emprunté, court-circuit ET/OU, écriture
// WON/LOST, et enchaînement jusqu'à recomputeBet() (points_awarded posés).
//
// Choisi comme 1er des 14 orchestrations de resolveCalculableBets.ts à
// tester (sur 14) : la plus complexe et celle où le plus de vrais bugs ont
// déjà été trouvés d'après JOURNAL_SESSIONS.md (négation, court-circuit OU
// imbriqué, corrélation dd/td). Les 13 autres seront couvertes une par une,
// même patron.
//
// Hors périmètre volontaire de ce fichier : la branche `.or()` de
// resolveNbaGameId (rapprochement PAR DATE quand aucun entity_mappings
// n'est encore posé) — tous les scénarios ci-dessous seedent soit un
// entity_mappings déjà en cache (cas normal en usage réel, cf.
// GAPS_OUVERTS.md "NBA Cup Alpha"), soit un match sciemment incomplet pour
// vérifier l'échec propre AVANT ce point. Le faux Supabase ne reproduit
// donc pas `.or()`/`.upsert()`, jamais sollicités par les scénarios testés.

import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private op: "select" | "update" = "select";
  private patch: Row | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(private store: Row[]) {}

  select(cols?: string) {
    void cols; // projection ignorée (fake sans colonnes), même choix que recompute.test.ts.
    // Ne change PAS l'opération : peut suivre .update() (Supabase renvoie
    // la ligne écrite via .select().maybeSingle(), utilisé par le garde
    // anti-concurrence de resolveCalculableComboBets) ou démarrer une
    // lecture pure.
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

const { resolveCalculableComboBets } = await import("./resolveCalculableBets");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}

// ── Fixtures communes ─────────────────────────────────────────────────────
// game_id NBA emprunté par le match app "m1" (mapping en cache, comme la
// NBA Cup Alpha réelle -- entity_mappings posé manuellement, jamais résolu
// par date dans ce fichier).
const GAME_ID = "0022500001";

function combo(
  ...groups: { kind: "PLAYER" | "TEAM"; player_ids?: number[]; team_id?: string; stats: string[]; threshold: number; comparison: "OVER" | "UNDER" }[][]
) {
  return { conditions: groups.map((or) => ({ or })) };
}

function boxScoreRow(overrides: Row): Row {
  return {
    game_id: GAME_ID,
    player_id: null,
    team_id: null,
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
    validated_difficulty: 3, // barème difficulté 3 -> 15 (recompute.test.ts).
    ...overrides,
  };
}

beforeEach(() => {
  fake.db = {};
  seed("matches", [{ id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: "2026-04-15T23:00:00.000Z" }]);
  seed("entity_mappings", [{ entity_type: "MATCH", source_type: "NBA_API", internal_id: "m1", source_ref: GAME_ID }]);
  // LeBron-like (201) : 28 pts, 6 reb, 8 ast -- sert de vérité de base à
  // plusieurs scénarios ci-dessous.
  seed("stats_box_scores", [boxScoreRow({ player_id: 201, pts: 28, reb: 6, ast: 8 })]);
});

describe("resolveCalculableComboBets — condition PLAYER simple", () => {
  it("groupe unique, condition vraie -> WON, et recomputeBet pose les points (difficulté 3 -> 15)", async () => {
    seed("bets", [betRow({ id: "betA", structured_combo: combo([{ kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 20, comparison: "OVER" }]) })]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([{ betId: "betA", outcome: "WON" }]);
    const row = readRow("bets", "betA");
    expect(row?.status).toBe("WON");
    expect(row?.points_awarded).toBe(15);
  });

  it("condition fausse -> LOST", async () => {
    seed("bets", [betRow({ id: "betA2", structured_combo: combo([{ kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 40, comparison: "OVER" }]) })]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([{ betId: "betA2", outcome: "LOST" }]);
    expect(readRow("bets", "betA2")?.status).toBe("LOST");
  });
});

describe("resolveCalculableComboBets — ET entre groupes, court-circuit (25/08/2026)", () => {
  it("1er groupe FAUX -> LOST immédiat, le 2e groupe (donnée manquante) n'est jamais évalué", async () => {
    // Si le court-circuit ne fonctionnait pas, le 2e groupe (joueur 999,
    // aucune ligne stats_box_scores) retournerait `null` (incomplet) et le
    // pari serait SKIPPED au lieu de LOST -- exactement le comportement que
    // ce test vérifie, conforme au commentaire du code ("résout les paris
    // perdus plus vite sans attendre des données qui ne changeront pas
    // l'issue").
    seed("bets", [
      betRow({
        id: "betB",
        structured_combo: combo(
          [{ kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 40, comparison: "OVER" }], // FAUX (28 <= 40).
          [{ kind: "PLAYER", player_ids: [999], stats: ["reb"], threshold: 5, comparison: "OVER" }] // jamais atteint.
        ),
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([{ betId: "betB", outcome: "LOST" }]);
    expect(summary.skipped).toEqual([]);
  });
});

describe("resolveCalculableComboBets — OU imbriqué dans un groupe (étape 7, 25/08/2026)", () => {
  it("groupe vrai dès qu'UNE condition l'est, même si la 1ère est fausse", async () => {
    seed("bets", [
      betRow({
        id: "betC",
        structured_combo: combo([
          { kind: "PLAYER", player_ids: [201], stats: ["ast"], threshold: 15, comparison: "OVER" }, // FAUX (8 ast).
          { kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 20, comparison: "OVER" }, // VRAI (28 pts).
        ]),
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([{ betId: "betC", outcome: "WON" }]);
  });
});

describe("resolveCalculableComboBets — condition SOMME (plusieurs joueurs)", () => {
  it("additionne la stat sur les joueurs listés, pas un seul", async () => {
    seed("stats_box_scores", [
      boxScoreRow({ player_id: 201, pts: 28 }),
      boxScoreRow({ player_id: 202, pts: 20 }),
    ]);
    seed("bets", [
      betRow({
        id: "betI",
        structured_combo: combo([{ kind: "PLAYER", player_ids: [201, 202], stats: ["pts"], threshold: 45, comparison: "OVER" }]), // 28+20=48 > 45.
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([{ betId: "betI", outcome: "WON" }]);
  });
});

describe("resolveCalculableComboBets — condition TEAM (resolveNbaTeamId)", () => {
  it("rapproche l'équipe app -> tricode -> id NBA, puis somme ses stats_box_scores", async () => {
    seed("teams", [{ id: "TEAM_A", abbreviation: "BOS" }]);
    seed("stats_equipes", [{ team_id: 1610612738, tricode: "BOS" }]);
    seed("stats_box_scores", [
      boxScoreRow({ player_id: 201, team_id: 1610612738, reb: 22 }),
      boxScoreRow({ player_id: 202, team_id: 1610612738, reb: 20 }),
      boxScoreRow({ player_id: 301, team_id: 1610612752, reb: 50 }), // autre équipe -- ne doit PAS compter.
    ]);
    seed("bets", [
      betRow({
        id: "betG",
        structured_combo: combo([{ kind: "TEAM", team_id: "TEAM_A", stats: ["reb"], threshold: 40, comparison: "OVER" }]), // 22+20=42 > 40.
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([{ betId: "betG", outcome: "WON" }]);
  });
});

describe("resolveCalculableComboBets — données pas encore synchronisées", () => {
  it("joueur sans ligne stats_box_scores sur l'unique groupe -> SKIPPED, jamais résolu en LOST", async () => {
    seed("bets", [
      betRow({
        id: "betD",
        structured_combo: combo([{ kind: "PLAYER", player_ids: [999], stats: ["pts"], threshold: 10, comparison: "OVER" }]),
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.resolved).toEqual([]);
    expect(summary.skipped).toEqual([{ betId: "betD", reason: "pas encore de stats synchronisées pour ce combo" }]);
    expect(readRow("bets", "betD")?.status).toBe("VALIDATED"); // inchangé -- jamais tranché à tort.
  });
});

describe("resolveCalculableComboBets — garde-fous d'éligibilité", () => {
  it("match pas encore terminé -> SKIPPED, aucune requête de stats émise", async () => {
    seed("matches", [{ id: "m2", status: "SCHEDULED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: null }]);
    seed("bets", [
      betRow({
        id: "betE",
        match_id: "m2",
        structured_combo: combo([{ kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 20, comparison: "OVER" }]),
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.skipped).toEqual([{ betId: "betE", reason: "match pas encore terminé" }]);
  });

  it("requête de correction en attente -> jamais résolu automatiquement, même si les stats trancheraient", async () => {
    seed("bets", [
      betRow({
        id: "betF",
        structured_combo: combo([{ kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 20, comparison: "OVER" }]), // trancherait WON.
      }),
    ]);
    seed("correction_requests", [{ target_bet_id: "betF", status: "PENDING" }]);

    const summary = await resolveCalculableComboBets();

    expect(summary.skipped).toEqual([{ betId: "betF", reason: "requête de correction en attente" }]);
    expect(readRow("bets", "betF")?.status).toBe("VALIDATED");
  });

  it("aucun match NBA correspondant (pas de mapping, pas assez d'info pour en chercher un) -> SKIPPED", async () => {
    seed("matches", [
      { id: "m1", status: "FINISHED", home_team_id: "TEAM_A", away_team_id: "TEAM_B", scheduled_at: "2026-04-15T23:00:00.000Z" },
      { id: "m3", status: "FINISHED", home_team_id: null, away_team_id: null, scheduled_at: null }, // pas assez d'info -> échec AVANT le rapprochement par date.
    ]);
    seed("entity_mappings", []); // aucun mapping en cache pour m3.
    seed("bets", [
      betRow({
        id: "betH",
        match_id: "m3",
        structured_combo: combo([{ kind: "PLAYER", player_ids: [201], stats: ["pts"], threshold: 20, comparison: "OVER" }]),
      }),
    ]);

    const summary = await resolveCalculableComboBets();

    expect(summary.skipped).toEqual([{ betId: "betH", reason: "match NBA correspondant introuvable" }]);
  });
});
