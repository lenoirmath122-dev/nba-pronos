import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateTag = vi.fn();
let cacheShouldFail = false;

// unstable_cache : passe-plat, ou échec simulé (hors runtime Next, ou lecture
// anon en erreur) pour vérifier le repli sur le client de la requête.
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (cacheShouldFail) throw new Error("Invariant: incrementalCache missing");
      return fn(...args);
    },
}));

function fakeClient(rows: Record<string, unknown>) {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const result = () => ({ data: rows[table] ?? null, error: null });
      for (const m of ["select", "eq", "not", "gt", "order"]) chain[m] = () => chain;
      chain.maybeSingle = async () => result();
      chain.then = (resolve: (v: unknown) => void) => resolve(result());
      return chain;
    },
  };
}

const anonRows: Record<string, unknown> = {};
vi.mock("@supabase/supabase-js", () => ({ createClient: () => fakeClient(anonRows) }));
vi.mock("@/lib/supabase/server", () => ({ getServerClient: vi.fn() }));

import {
  COMMON_TAGS,
  getActiveCompetition,
  getUpcomingMatches,
  invalidateAllCommonData,
  invalidateCommonData,
} from "./commonData";

beforeEach(() => {
  revalidateTag.mockReset();
  cacheShouldFail = false;
  for (const k of Object.keys(anonRows)) delete anonRows[k];
});

describe("invalidateCommonData", () => {
  it("expire immédiatement chaque tag demandé (expire: 0, jamais stale-while-revalidate)", () => {
    invalidateCommonData(COMMON_TAGS.matches, COMMON_TAGS.series);
    expect(revalidateTag).toHaveBeenCalledTimes(2);
    expect(revalidateTag).toHaveBeenNthCalledWith(1, COMMON_TAGS.matches, { expire: 0 });
    expect(revalidateTag).toHaveBeenNthCalledWith(2, COMMON_TAGS.series, { expire: 0 });
  });

  it("invalidateAllCommonData couvre les 4 tags", () => {
    invalidateAllCommonData();
    const tags = revalidateTag.mock.calls.map((c) => c[0]);
    expect(tags.sort()).toEqual(Object.values(COMMON_TAGS).sort());
  });

  it("ne lève jamais hors contexte Next", () => {
    revalidateTag.mockImplementation(() => {
      throw new Error("static generation store missing");
    });
    expect(() => invalidateCommonData(COMMON_TAGS.leaderboard)).not.toThrow();
  });
});

describe("lectures communes : cache puis repli", () => {
  it("compétition active : lue via le client anon quand le cache fonctionne", async () => {
    anonRows.competitions = { id: "c1", name: "Cup", type: "NBA_CUP", bracket_deadline: null };
    expect(await getActiveCompetition(fakeClient({}) as never)).toMatchObject({ id: "c1" });
  });

  it("compétition active : repli sur le client de la requête si le cache échoue", async () => {
    cacheShouldFail = true;
    const row = { id: "c2", name: "Playoffs", type: "PLAYOFFS", bracket_deadline: null };
    expect(await getActiveCompetition(fakeClient({ competitions: row }) as never)).toEqual(row);
  });

  it("matchs à venir : coupe à l'instant exact même si la fenêtre cachée démarre à l'heure ronde", async () => {
    const now = Date.parse("2026-11-05T20:30:00Z");
    anonRows.matches = [
      { id: "passe", series_id: "s", scheduled_at: "2026-11-05T20:10:00.000Z", home_team_id: "a", away_team_id: "b" },
      { id: "futur", series_id: "s", scheduled_at: "2026-11-05T21:00:00.000Z", home_team_id: "a", away_team_id: "b" },
    ];
    const rows = await getUpcomingMatches(fakeClient({}) as never, "c1", now);
    expect(rows.map((r) => r.id)).toEqual(["futur"]);
  });

  it("matchs à venir : repli sur le client de la requête si le cache échoue", async () => {
    cacheShouldFail = true;
    const fallback = [
      { id: "m1", series_id: "s", scheduled_at: "2026-11-06T00:00:00.000Z", home_team_id: "a", away_team_id: "b" },
    ];
    const rows = await getUpcomingMatches(
      fakeClient({ matches: fallback }) as never,
      "c1",
      Date.parse("2026-11-05T20:30:00Z")
    );
    expect(rows).toEqual(fallback);
  });
});
