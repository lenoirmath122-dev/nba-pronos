// Test de computeBetDeadlines()/computeBetDeadlinesPassed() (B3 de l'audit
// du 04/09/2026, BUG-002) -- garantit l'équivalence avec
// public.bet_deadline_open() avant/après avoir migré lib/queries/home.ts et
// lib/queries/admin-dashboard.ts vers cette unique implémentation.

import { describe, it, expect } from "vitest";
import { computeBetDeadlines, computeBetDeadlinesPassed, type BetDeadlineTarget } from "./bet-deadline";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];

  constructor(private store: Row[]) {}

  select(cols?: string) {
    void cols;
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  not(col: string, op: string, val: unknown) {
    void op;
    void val;
    this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const rows = this.store.filter((r) => this.filters.every((f) => f(r)));
    const result = { data: rows, error: null };
    return Promise.resolve(onfulfilled ? onfulfilled(result) : (result as TResult1));
  }
}

function fakeSupabase(matches: Row[]) {
  return {
    from(table: string) {
      if (table !== "matches") throw new Error(`table inattendue: ${table}`);
      return new FakeBuilder(matches);
    },
  } as never;
}

const inOneHour = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

describe("computeBetDeadlines", () => {
  it("pari MATCH -> échéance = coup d'envoi du match visé", async () => {
    const supabase = fakeSupabase([{ id: "m1", series_id: "s1", scheduled_at: inTwoDays }]);
    const bets: BetDeadlineTarget[] = [{ id: "b1", scope: "MATCH", seriesId: "s1", matchId: "m1" }];

    const deadlines = await computeBetDeadlines(supabase, bets);

    expect(deadlines.get("b1")).toBe(inTwoDays);
  });

  it("pari SERIES -> échéance = coup d'envoi du 1er match de la série (le plus tôt, pas le premier renvoyé)", async () => {
    const supabase = fakeSupabase([
      { id: "m2", series_id: "s1", scheduled_at: inTwoDays },
      { id: "m1", series_id: "s1", scheduled_at: inOneHour },
    ]);
    const bets: BetDeadlineTarget[] = [{ id: "b1", scope: "SERIES", seriesId: "s1", matchId: null }];

    const deadlines = await computeBetDeadlines(supabase, bets);

    expect(deadlines.get("b1")).toBe(inOneHour);
  });

  it("aucun match planifié -> échéance null (jamais bloquant)", async () => {
    const supabase = fakeSupabase([{ id: "m1", series_id: "s1", scheduled_at: null }]);
    const bets: BetDeadlineTarget[] = [{ id: "b1", scope: "MATCH", seriesId: "s1", matchId: "m1" }];

    const deadlines = await computeBetDeadlines(supabase, bets);

    expect(deadlines.get("b1")).toBeNull();
  });

  it("liste vide -> aucune requête, Map vide", async () => {
    const deadlines = await computeBetDeadlines(fakeSupabase([]), []);
    expect(deadlines.size).toBe(0);
  });
});

describe("computeBetDeadlinesPassed", () => {
  it("échéance dans le futur -> pas dans le set des passées", async () => {
    const supabase = fakeSupabase([{ id: "m1", series_id: "s1", scheduled_at: inTwoDays }]);
    const bets: BetDeadlineTarget[] = [{ id: "b1", scope: "MATCH", seriesId: "s1", matchId: "m1" }];

    const passed = await computeBetDeadlinesPassed(supabase, bets);

    expect(passed.has("b1")).toBe(false);
  });

  it("échéance dans le passé -> dans le set des passées", async () => {
    const supabase = fakeSupabase([{ id: "m1", series_id: "s1", scheduled_at: yesterday }]);
    const bets: BetDeadlineTarget[] = [{ id: "b1", scope: "MATCH", seriesId: "s1", matchId: "m1" }];

    const passed = await computeBetDeadlinesPassed(supabase, bets);

    expect(passed.has("b1")).toBe(true);
  });

  it("aucun match planifié -> jamais considéré passé", async () => {
    const supabase = fakeSupabase([{ id: "m1", series_id: "s1", scheduled_at: null }]);
    const bets: BetDeadlineTarget[] = [{ id: "b1", scope: "MATCH", seriesId: "s1", matchId: "m1" }];

    const passed = await computeBetDeadlinesPassed(supabase, bets);

    expect(passed.has("b1")).toBe(false);
  });
});
