// Tests de l'ORCHESTRATION (SPEC_TECHNIQUE_SCORING_V0_1 §10, cas 28-32 du
// plan §11) — recomputeMatch/recomputeSeries/recomputeBet/recomputeCompetition,
// contre une base FAKE en mémoire (voir FakeSupabase ci-dessous), jamais une
// vraie instance Supabase. Complète engine.test.ts (moteur pur, cas 1-27),
// qui référençait déjà ce fichier comme lot suivant.
//
// Écrit en réponse à l'audit structurel du 28/07/2026 (GAPS_OUVERTS.md) :
// ces cas n'avaient jusqu'ici été vérifiés qu'une fois, via un test
// d'intégration jetable contre une vraie base, supprimé après coup — pas de
// façon reproductible. Couvre :
// - P5 (idempotence) : recomputeMatch/Series/Bet/Competition rejoués 2 fois
//   de suite produisent un état RIGOUREUSEMENT identique (jamais de double
//   comptage).
// - P6 (jamais de valeur négative) : vérifié sur chaque scénario, y compris
//   les cas neutralisés/perdus/annulés.
// - Cas 5 du plan §11 (garde CANCELLED/POSTPONED) : deriveSeriesOutcome ne
//   connaît pas le statut déjà posé en base (fonction pure, engine.ts) — le
//   garde-fou vit dans recomputeMatch (ADMIN_LOCKED_STATUSES). Testé ici,
//   comme annoncé par le commentaire d'engine.test.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Fake Supabase (test-only) ────────────────────────────────────────────
// Reproduit UNIQUEMENT le sous-ensemble de l'API supabase-js utilisé par
// lib/scoring/recompute.ts et lib/sync/writeSeriesOutcome.ts : .from(table)
// .select()/.update(patch), .eq()/.in() (filtres cumulés), .single()/
// .maybeSingle() (sinon résultat en tableau). Pas de transaction réelle —
// suffisant pour vérifier l'idempotence de LA LOGIQUE d'orchestration,
// pas le comportement transactionnel de Postgres (hors périmètre de ce lot).

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private mode: "select" | "update" = "select";
  private patch: Row | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(private store: Row[]) {}

  select(cols?: string) {
    void cols; // signature compatible avec supabase-js, projection ignorée (fake sans colonnes).
    this.mode = "select";
    return this;
  }
  update(patch: Row) {
    this.mode = "update";
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
    let result: unknown;
    if (this.mode === "update") {
      const rows = this.matched();
      for (const r of rows) Object.assign(r, this.patch);
      result = { data: rows, error: null };
    } else {
      const rows = this.matched();
      if (this.singleMode === "single") {
        result = { data: rows[0] ?? null, error: rows[0] ? null : { message: "not found" } };
      } else if (this.singleMode === "maybe") {
        result = { data: rows[0] ?? null, error: null };
      } else {
        result = { data: rows, error: null };
      }
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

const { recomputeMatch, recomputeSeries, recomputeBet, recomputeCompetition } = await import("./recompute");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}
function readRow(table: string, id: string): Row | undefined {
  return fake.db[table]?.find((r) => r.id === id);
}
function expectNoNegative(row: Row | undefined, fields: string[]) {
  for (const f of fields) {
    const v = row?.[f];
    if (typeof v === "number") expect(v, `${f} ne doit jamais être négatif`).toBeGreaterThanOrEqual(0);
  }
}

beforeEach(() => {
  fake.db = {};
  // Horloge figée : recompute.ts pose `scored_at = new Date().toISOString()`
  // à chaque passe. Sans horloge figée, comparer deux passes successives
  // avec toEqual() serait FLAKY (deux vrais timestamps millisecondes
  // distincts) alors que la propriété testée ici est l'idempotence des
  // COLONNES DE POINTS, pas l'instant de calcul.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// ── recomputeMatch — scoring des pronos, idempotence (P5) ───────────────

describe("recomputeMatch — idempotence des pronos (cas 28)", () => {
  beforeEach(() => {
    seed("competitions", [{ id: "c1", type: "PLAYOFFS" }]);
    seed("series", [
      {
        id: "s1",
        round: "ROUND_1",
        competition_id: "c1",
        official_status: "IN_PROGRESS",
        official_winner_team_id: null,
        official_score_format: null,
        team1_id: "A",
        team2_id: "B",
      },
    ]);
    seed("matches", [
      {
        id: "m1",
        series_id: "s1",
        competition_id: "c1",
        status: "FINISHED",
        home_team_id: "A",
        away_team_id: "B",
        home_score: 100,
        away_score: 90,
      },
    ]);
    seed("match_predictions", [
      { id: "p1", match_id: "m1", predicted_winner_team_id: "A", predicted_margin: 10, status: "VALIDATED" },
      { id: "p2", match_id: "m1", predicted_winner_team_id: "B", predicted_margin: 5, status: "DRAFT" }, // DRAFT mais COMPLET → figé quand même (§10.1, complétude prime).
      { id: "p3", match_id: "m1", predicted_winner_team_id: null, predicted_margin: null, status: "DRAFT" }, // brouillon vide → jamais scoré (ABSENT).
    ]);
  });

  it("gagnant + marge exacts → 10 + bonus max (5), stable sur 2 passes", async () => {
    await recomputeMatch("m1");
    const after1 = { ...readRow("match_predictions", "p1") };
    await recomputeMatch("m1");
    const after2 = readRow("match_predictions", "p1");

    expect(after1).toEqual({
      id: "p1",
      match_id: "m1",
      predicted_winner_team_id: "A",
      predicted_margin: 10,
      status: "VALIDATED",
      is_winner_correct: true,
      margin_diff: 0,
      winner_points: 10,
      margin_bonus_points: 5,
      scored_at: expect.any(String),
    });
    // Rejouée : AUCUNE accumulation (P5) — état rigoureusement identique.
    expect(after2).toEqual(after1);
    expectNoNegative(after2, ["winner_points", "margin_bonus_points"]);
  });

  it("DRAFT complet mais mauvais vainqueur → 0 pt, jamais négatif, stable", async () => {
    await recomputeMatch("m1");
    const after1 = { ...readRow("match_predictions", "p2") };
    await recomputeMatch("m1");
    const after2 = readRow("match_predictions", "p2");

    expect(after1.is_winner_correct).toBe(false);
    expect(after1.winner_points).toBe(0);
    expect(after1.margin_bonus_points).toBe(0);
    expect(after2).toEqual(after1);
    expectNoNegative(after2, ["winner_points", "margin_bonus_points"]);
  });

  it("brouillon vide → jamais scoré (ABSENT, tous les champs à NULL), stable", async () => {
    await recomputeMatch("m1");
    const after1 = { ...readRow("match_predictions", "p3") };
    await recomputeMatch("m1");
    const after2 = readRow("match_predictions", "p3");

    expect(after1.winner_points).toBeNull();
    expect(after1.margin_bonus_points).toBeNull();
    expect(after1.scored_at).toBeNull();
    expect(after2).toEqual(after1);
  });
});

// ── recomputeMatch → série complétée → recomputeSeries (bracket picks) ──

describe("recomputeMatch — complétion de série + scoring bracket, idempotence (cas 29)", () => {
  beforeEach(() => {
    seed("competitions", [{ id: "c2", type: "PLAYOFFS" }]);
    seed("series", [
      {
        id: "s2",
        round: "ROUND_1",
        competition_id: "c2",
        official_status: "IN_PROGRESS",
        official_winner_team_id: null,
        official_score_format: null,
        team1_id: "A",
        team2_id: "B",
      },
    ]);
    // Sweep 4-0 pour A — le 4e match (m4) est celui qui déclenche la
    // complétion quand recomputeMatch le traite.
    seed(
      "matches",
      [1, 2, 3, 4].map((n) => ({
        id: `m${n}`,
        series_id: "s2",
        competition_id: "c2",
        status: "FINISHED",
        home_team_id: "A",
        away_team_id: "B",
        home_score: 100,
        away_score: 90,
      }))
    );
    seed("bracket_picks", [
      { id: "pick1", bracket_id: "b1", series_id: "s2", predicted_winner_team_id: "A", predicted_score_format: "4-0" },
      { id: "pick2", bracket_id: "b2", series_id: "s2", predicted_winner_team_id: "B", predicted_score_format: "4-1" },
    ]);
  });

  it("série dérivée FINISHED/A/4-0, picks scorés, stable sur 2 passes", async () => {
    await recomputeMatch("m4");
    const seriesAfter1 = { ...readRow("series", "s2") };
    const pick1After1 = { ...readRow("bracket_picks", "pick1") };
    const pick2After1 = { ...readRow("bracket_picks", "pick2") };

    expect(seriesAfter1.official_status).toBe("FINISHED");
    expect(seriesAfter1.official_winner_team_id).toBe("A");
    expect(seriesAfter1.official_score_format).toBe("4-0");

    // Pick exact (vainqueur + score) — ROUND_1 : 25 (vainqueur) + 10 (score exact) + 0 (affiche, ROUND_1 sans matchup à deviner).
    expect(pick1After1.winner_points).toBe(25);
    expect(pick1After1.exact_score_points).toBe(10);
    expect(pick1After1.matchup_points).toBe(0);
    // Mauvais vainqueur → tout à 0.
    expect(pick2After1.winner_points).toBe(0);
    expect(pick2After1.exact_score_points).toBe(0);

    await recomputeMatch("m4");
    expect(readRow("series", "s2")).toEqual(seriesAfter1);
    expect(readRow("bracket_picks", "pick1")).toEqual(pick1After1);
    expect(readRow("bracket_picks", "pick2")).toEqual(pick2After1);
    expectNoNegative(readRow("bracket_picks", "pick1"), ["winner_points", "exact_score_points", "matchup_points"]);
    expectNoNegative(readRow("bracket_picks", "pick2"), ["winner_points", "exact_score_points", "matchup_points"]);
  });
});

// ── Garde CANCELLED/POSTPONED (cas 5 du plan §11, annoncé par engine.test.ts) ─

describe("recomputeMatch — garde d'orchestration CANCELLED (cas 5)", () => {
  beforeEach(() => {
    seed("competitions", [{ id: "c3", type: "PLAYOFFS" }]);
    seed("series", [
      {
        id: "s3",
        round: "ROUND_1",
        competition_id: "c3",
        official_status: "CANCELLED", // déjà posé par un admin (A2).
        official_winner_team_id: null,
        official_score_format: null,
        team1_id: "A",
        team2_id: "B",
      },
    ]);
    // Ce match, pris isolément, dériverait un vainqueur (A) si on ignorait
    // le statut CANCELLED déjà posé — exactement ce que le garde-fou doit
    // empêcher (ADMIN_LOCKED_STATUSES, lib/scoring/recompute.ts).
    seed("matches", [
      {
        id: "m5",
        series_id: "s3",
        competition_id: "c3",
        status: "FINISHED",
        home_team_id: "A",
        away_team_id: "B",
        home_score: 100,
        away_score: 90,
      },
    ]);
    seed("bracket_picks", [
      { id: "pick3", bracket_id: "b3", series_id: "s3", predicted_winner_team_id: "A", predicted_score_format: "4-0" },
    ]);
  });

  it("le statut CANCELLED n'est JAMAIS écrasé par la dérivation, picks neutralisés à 0", async () => {
    await recomputeMatch("m5");
    const series = readRow("series", "s3");
    expect(series?.official_status).toBe("CANCELLED"); // pas "FINISHED" — le garde-fou a tenu.
    expect(series?.official_winner_team_id).toBeNull();

    const pick = readRow("bracket_picks", "pick3");
    // Neutralisation A2 : 0 partout, jamais NULL (contrairement à "en attente").
    expect(pick?.winner_points).toBe(0);
    expect(pick?.exact_score_points).toBe(0);
    expect(pick?.matchup_points).toBe(0);
    expect(pick?.is_winner_correct).toBeNull();
    expectNoNegative(pick, ["winner_points", "exact_score_points", "matchup_points"]);
  });
});

// ── recomputeBet — idempotence + P6 ──────────────────────────────────────

describe("recomputeBet — idempotence et jamais de valeur négative (cas 30)", () => {
  it("WON avec validated_difficulty → barème exact, stable sur 2 passes", async () => {
    seed("bets", [{ id: "bet1", competition_id: "c4", status: "WON", validated_difficulty: 3 }]);
    await recomputeBet("bet1");
    const after1 = { ...readRow("bets", "bet1") };
    await recomputeBet("bet1");
    expect(readRow("bets", "bet1")).toEqual(after1);
    expect(after1.points_awarded).toBe(15); // barème difficulté 3 → 15.
    expectNoNegative(after1, ["points_awarded"]);
  });

  it("LOST → 0 point, jamais négatif", async () => {
    seed("bets", [{ id: "bet2", competition_id: "c4", status: "LOST", validated_difficulty: null }]);
    await recomputeBet("bet2");
    expect(readRow("bets", "bet2")?.points_awarded).toBe(0);
  });

  it("CANCELLED → 0 point (neutralisé, pas pénalisé)", async () => {
    seed("bets", [{ id: "bet3", competition_id: "c4", status: "CANCELLED", validated_difficulty: null }]);
    await recomputeBet("bet3");
    expect(readRow("bets", "bet3")?.points_awarded).toBe(0);
  });

  it("VALIDATED (non résolu) → NULL, jamais 0 ni négatif (pas encore hors jeu)", async () => {
    seed("bets", [{ id: "bet4", competition_id: "c4", status: "VALIDATED", validated_difficulty: null }]);
    await recomputeBet("bet4");
    expect(readRow("bets", "bet4")?.points_awarded).toBeNull();
  });
});

// ── recomputeCompetition — filet de sécurité, idempotence bout en bout ──

describe("recomputeCompetition — rejeu intégral idempotent (cas 31-32)", () => {
  beforeEach(() => {
    seed("competitions", [{ id: "c4", type: "PLAYOFFS" }]);
    // Série DÉJÀ résolue en base (4-1, A vainqueur) — cohérente avec les 5
    // matchs seedés (A gagne 4, perd 1) pour que recomputeMatch ne trouve
    // rien à changer (hasChanged=false) et n'appelle pas writeSeriesOutcome ;
    // recomputeCompetition rescore quand même les picks via son propre appel
    // à recomputeSeries.
    seed("series", [
      {
        id: "s4",
        round: "ROUND_1",
        competition_id: "c4",
        official_status: "FINISHED",
        official_winner_team_id: "A",
        official_score_format: "4-1",
        team1_id: "A",
        team2_id: "B",
      },
    ]);
    seed("matches", [
      { id: "n1", series_id: "s4", competition_id: "c4", status: "FINISHED", home_team_id: "A", away_team_id: "B", home_score: 100, away_score: 90 },
      { id: "n2", series_id: "s4", competition_id: "c4", status: "FINISHED", home_team_id: "A", away_team_id: "B", home_score: 100, away_score: 90 },
      { id: "n3", series_id: "s4", competition_id: "c4", status: "FINISHED", home_team_id: "B", away_team_id: "A", home_score: 100, away_score: 90 }, // A perd celui-là (B domicile gagne).
      { id: "n4", series_id: "s4", competition_id: "c4", status: "FINISHED", home_team_id: "A", away_team_id: "B", home_score: 100, away_score: 90 },
      { id: "n5", series_id: "s4", competition_id: "c4", status: "FINISHED", home_team_id: "A", away_team_id: "B", home_score: 100, away_score: 90 },
    ]);
    seed("match_predictions", [
      { id: "np1", match_id: "n1", predicted_winner_team_id: "A", predicted_margin: 10, status: "VALIDATED" },
    ]);
    seed("bracket_picks", [
      { id: "pick4", bracket_id: "b4", series_id: "s4", predicted_winner_team_id: "A", predicted_score_format: "4-1" },
    ]);
    seed("bets", [{ id: "bet5", competition_id: "c4", status: "WON", validated_difficulty: 5 }]);
  });

  it("rejouée 2 fois de suite, la compétition entière produit un état identique", async () => {
    await recomputeCompetition("c4");
    const snapshot1 = JSON.parse(JSON.stringify(fake.db));
    await recomputeCompetition("c4");
    const snapshot2 = JSON.parse(JSON.stringify(fake.db));

    expect(snapshot2).toEqual(snapshot1); // P5 : aucune dérive après un rejeu complet.

    // P6 : aucune valeur négative nulle part dans tout l'état final.
    for (const rows of Object.values(fake.db) as Row[][]) {
      for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
          if (typeof value === "number") {
            expect(value, `${key} de ${JSON.stringify(row.id)} ne doit jamais être négatif`).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }

    expect(readRow("match_predictions", "np1")?.winner_points).toBe(10);
    expect(readRow("bracket_picks", "pick4")?.winner_points).toBe(25);
    expect(readRow("bracket_picks", "pick4")?.exact_score_points).toBe(10); // 4-1 prédit == 4-1 officiel.
    expect(readRow("bets", "bet5")?.points_awarded).toBe(25); // difficulté 5 → 25.
  });
});

// ── recomputeSeries appelée seule (sans passer par recomputeMatch) ───────

describe("recomputeSeries — idempotence directe (cas 28, variante)", () => {
  it("rejouée seule sur une série déjà résolue, résultat stable", async () => {
    seed("series", [
      {
        id: "s5",
        round: "CONF_SEMIS",
        competition_id: "c5",
        official_status: "FINISHED",
        official_winner_team_id: "A",
        official_score_format: "4-2",
        team1_id: "A",
        team2_id: "B",
      },
    ]);
    seed("bracket_picks", [
      { id: "pick5", bracket_id: "b5", series_id: "s5", predicted_winner_team_id: "A", predicted_score_format: "4-2" },
    ]);

    await recomputeSeries("s5");
    const after1 = { ...readRow("bracket_picks", "pick5") };
    await recomputeSeries("s5");
    expect(readRow("bracket_picks", "pick5")).toEqual(after1);

    // CONF_SEMIS : 45 (vainqueur) + 20 (score exact). Affiche : la paire
    // OFFICIELLE est connue (team1_id/team2_id de s5), mais aucune série
    // feeder n'est seedée → paire PRÉDITE absente → "connue côté officiel
    // mais le joueur n'a pas routé de paire complète" = FAUX, 0 (pas "en
    // attente" : ce cas-là exige l'officielle inconnue, pas la prédite).
    expect(after1.winner_points).toBe(45);
    expect(after1.exact_score_points).toBe(20);
    expect(after1.is_matchup_correct).toBe(false);
    expect(after1.matchup_points).toBe(0);
    expectNoNegative(after1, ["winner_points", "exact_score_points", "matchup_points"]);
  });
});
