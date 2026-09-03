// Test de resolveKnownRosters() (BUG-003 de l'audit du 03/09/2026,
// GAPS_OUVERTS.md) -- même faux Supabase minimal que les fichiers
// resolveCalculableXxxBets.test.ts (FakeBuilder dupliqué ici plutôt que
// partagé, même convention établie dans ce dossier).

import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = Record<string, unknown>;

class FakeBuilder {
  private filters: Array<(r: Row) => boolean> = [];
  private singleMode: "none" | "maybe" = "none";

  constructor(private store: Row[]) {}

  select(cols?: string) {
    void cols;
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
  gte(col: string, val: string) {
    this.filters.push((r) => (r[col] as string) >= val);
    return this;
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
    const result = this.singleMode === "maybe" ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
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

const { resolveKnownRosters } = await import("./roster");

function seed(table: string, rows: Row[]) {
  fake.db[table] = rows.map((r) => ({ ...r }));
}

const TODAY = new Date().toISOString().slice(0, 10);
const OLD_DATE = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe("resolveKnownRosters", () => {
  beforeEach(() => {
    fake.db = {};
  });

  it("retourne null si une des 2 équipes n'a pas d'abréviation (série pas totalement résolue)", async () => {
    seed("teams", [{ id: "app-team-1", abbreviation: "BOS" }]);
    const result = await resolveKnownRosters("app-team-1", "app-team-2");
    expect(result).toBeNull();
  });

  it("retourne null si une équipe n'est pas mappée côté pipeline stats (ex. équipe NBA Cup Alpha fictive)", async () => {
    seed("teams", [
      { id: "app-team-1", abbreviation: "BOS" },
      { id: "app-team-2", abbreviation: "ZZZ" },
    ]);
    seed("stats_equipes", [{ team_id: 1, tricode: "BOS" }]);
    const result = await resolveKnownRosters("app-team-1", "app-team-2");
    expect(result).toBeNull();
  });

  it("retourne les effectifs déduits des stats_box_scores récentes, triés et dédupliqués", async () => {
    seed("teams", [
      { id: "app-team-1", abbreviation: "BOS" },
      { id: "app-team-2", abbreviation: "LAL" },
    ]);
    seed("stats_equipes", [
      { team_id: 1, tricode: "BOS" },
      { team_id: 2, tricode: "LAL" },
    ]);
    seed("stats_box_scores", [
      { player_id: 10, team_id: 1, game_date: TODAY },
      // 2e match récent du même joueur -- ne doit pas dupliquer l'entrée.
      { player_id: 10, team_id: 1, game_date: TODAY },
      { player_id: 11, team_id: 1, game_date: TODAY },
      // Hors fenêtre (200 jours) -- doit être exclu du roster.
      { player_id: 99, team_id: 1, game_date: OLD_DATE },
      { player_id: 20, team_id: 2, game_date: TODAY },
    ]);
    seed("stats_joueurs", [
      { player_id: 10, first_name: "Jayson", family_name: "Tatum" },
      { player_id: 11, first_name: "Jrue", family_name: "Holiday" },
      { player_id: 99, first_name: "Ancien", family_name: "Joueur" },
      { player_id: 20, first_name: "LeBron", family_name: "James" },
    ]);

    const result = await resolveKnownRosters("app-team-1", "app-team-2");

    expect(result).toEqual({
      team1: ["Jayson Tatum", "Jrue Holiday"],
      team2: ["LeBron James"],
    });
  });

  it("ne lève jamais -- retourne null si le client Supabase échoue", async () => {
    seed("teams", [
      { id: "app-team-1", abbreviation: "BOS" },
      { id: "app-team-2", abbreviation: "LAL" },
    ]);
    const originalFrom = fake.from.bind(fake);
    fake.from = (table: string) => {
      if (table === "stats_equipes") throw new Error("panne réseau simulée");
      return originalFrom(table);
    };

    const result = await resolveKnownRosters("app-team-1", "app-team-2");
    expect(result).toBeNull();

    fake.from = originalFrom;
  });
});
