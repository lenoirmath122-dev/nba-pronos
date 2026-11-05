import { describe, it, expect, vi, beforeEach } from "vitest";

// Les recomputes écrivent points, séries et résultats : chacun doit invalider
// les lectures communes en cache (classement, matchs, séries), succès OU échec
// partiel (le bloc finally). L'orchestration elle-même est couverte par
// recompute.test.ts ; ici on ne vérifie QUE l'invalidation.

const invalidate = vi.fn();
let serviceFails = false;

vi.mock("@/lib/cache/commonData", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/cache/commonData")>()),
  invalidateCommonData: (...tags: unknown[]) => invalidate(...tags),
}));
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => {
    if (serviceFails) throw new Error("service indisponible");
    // Base vide : chaque lecture renvoie « rien trouvé », les recomputes sortent sans écrire.
    const chain: Record<string, unknown> = {};
    const empty = { data: null, error: null };
    for (const m of ["select", "eq", "in", "update", "order", "limit"]) chain[m] = () => chain;
    chain.single = async () => empty;
    chain.maybeSingle = async () => empty;
    chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
    return { from: () => chain };
  },
}));

const { recomputeMatch, recomputeSeries, recomputeBet, recomputeCompetition } = await import("./recompute");
const { COMMON_TAGS } = await import("@/lib/cache/commonData");

const expectedTags = [COMMON_TAGS.leaderboard, COMMON_TAGS.matches, COMMON_TAGS.series];

beforeEach(() => {
  invalidate.mockReset();
  serviceFails = false;
});

describe("recompute* : invalidation du cache commun", () => {
  it.each([
    ["recomputeMatch", () => recomputeMatch("m1")],
    ["recomputeSeries", () => recomputeSeries("s1")],
    ["recomputeBet", () => recomputeBet("b1")],
    ["recomputeCompetition", () => recomputeCompetition("c1")],
  ])("%s invalide classement, matchs et séries même en cas d'échec", async (_name, run) => {
    serviceFails = true;
    await expect(run()).rejects.toThrow("service indisponible");
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith(...expectedTags);
  });

  it("invalide aussi quand le recompute se termine sans erreur", async () => {
    await recomputeCompetition("c1").catch(() => undefined);
    expect(invalidate).toHaveBeenCalledWith(...expectedTags);
  });
});
