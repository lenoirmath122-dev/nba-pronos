import { describe, it, expect, vi, beforeEach } from "vitest";

const getMatchesByDate = vi.fn();
vi.mock("@/lib/nba/client", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/nba/client")>()),
  getMatchesByDate: (d: string) => getMatchesByDate(d),
}));
vi.mock("@/lib/scoring/recompute", () => ({ recomputeMatch: vi.fn() }));
vi.mock("@/lib/scoring/advancement", () => ({ advanceWinnerIfDecided: vi.fn() }));

const updates: unknown[] = [];
let competitionType = "PLAYOFFS";
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: { type: competitionType } }),
        in: () =>
          Promise.resolve({
            data:
              table === "entity_mappings"
                ? [{ internal_id: "m1", source_ref: "1" }]
                : [{ id: "m1", series_id: "s1", status: "SCHEDULED", home_score: null, away_score: null, went_to_ot: null, quarter_scores: null }],
          }),
        update: (payload: unknown) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return chain;
    },
  }),
}));

import { syncResults } from "./results";

const raw = (id: number) => ({
  id,
  league: "NBA",
  state: { description: "Finished", score: { homeTeam: [25, 25, 25, 25], awayTeam: [20, 20, 20, 20] } },
});

// 00h30 NY (EDT) -> fenêtre veille + jour.
const NIGHT = new Date("2026-10-07T04:30:00Z");
// Midi UTC (8h NY) -> jour seul.
const DAY = new Date("2026-10-07T12:00:00Z");

describe("syncResults — veille NY", () => {
  beforeEach(() => {
    getMatchesByDate.mockReset();
    updates.length = 0;
    competitionType = "PLAYOFFS";
  });

  it("interroge veille puis jour dans la fenêtre de nuit", async () => {
    getMatchesByDate.mockResolvedValue({ data: [], requestsRemaining: 5 });
    await syncResults(NIGHT);
    expect(getMatchesByDate.mock.calls.map((c) => c[0])).toEqual(["2026-10-06", "2026-10-07"]);
  });

  it("n'interroge que le jour hors fenêtre", async () => {
    getMatchesByDate.mockResolvedValue({ data: [], requestsRemaining: 5 });
    await syncResults(DAY);
    expect(getMatchesByDate.mock.calls.map((c) => c[0])).toEqual(["2026-10-07"]);
  });

  it("dédoublonne un match renvoyé sur les deux jours (une seule mise à jour)", async () => {
    getMatchesByDate
      .mockResolvedValueOnce({ data: [raw(1)], requestsRemaining: 9 })
      .mockResolvedValueOnce({ data: [raw(1)], requestsRemaining: 8 });
    const r = await syncResults(NIGHT);
    expect(updates).toHaveLength(1);
    expect(r.changed).toBe(1);
    expect(r.requestsRemaining).toBe(8);
  });

  it("une erreur sur la veille n'empêche pas de traiter le jour", async () => {
    getMatchesByDate
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValueOnce({ data: [raw(1)], requestsRemaining: 7 });
    const r = await syncResults(NIGHT);
    expect(r.changed).toBe(1);
    expect(r.failedDates).toEqual([{ date: "2026-10-06", message: "429" }]);
  });

  it("relance l'erreur si toutes les dates échouent", async () => {
    getMatchesByDate.mockRejectedValue(new Error("down"));
    await expect(syncResults(NIGHT)).rejects.toThrow("down");
  });

  it("DAILY_MATCH : les matchs non mappés sont comptés, pas listés dans skipped", async () => {
    competitionType = "DAILY_MATCH";
    getMatchesByDate.mockResolvedValue({ data: [raw(1), raw(2), raw(3)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.notDrawn).toBe(2);
    expect(r.skipped).toEqual([]);
    expect(r.changed).toBe(1);
  });

  it("Playoffs : un match non mappé reste listé dans skipped (inchangé)", async () => {
    getMatchesByDate.mockResolvedValue({ data: [raw(1), raw(2)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.notDrawn).toBe(0);
    expect(r.skipped).toHaveLength(1);
  });
});
