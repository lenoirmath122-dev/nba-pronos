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
let matchStatus = "SCHEDULED";
let updateData: unknown[] = [{ id: "m1" }];
let matchExtras: Record<string, unknown> = {};
let nbaTracked = false; // m1 a un mapping NBA_LIVE (suivi par le poller NBA)
vi.mock("@/lib/supabase/service", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      let sourceType = "";
      const chain = {
        select: () => chain,
        eq: (column: string, value: string) => {
          if (column === "source_type") sourceType = value;
          return chain;
        },
        maybeSingle: () => Promise.resolve({ data: { type: competitionType } }),
        in: () =>
          Promise.resolve({
            data:
              table === "entity_mappings"
                ? sourceType === "NBA_LIVE"
                  ? nbaTracked ? [{ internal_id: "m1" }] : []
                  : [{ internal_id: "m1", source_ref: "1" }]
                : [{ id: "m1", series_id: "s1", status: matchStatus, home_score: null, away_score: null, went_to_ot: null, quarter_scores: null, ...matchExtras }],
          }),
        update: (payload: unknown) => {
          updates.push(payload);
          const upd = { eq: () => upd, select: () => Promise.resolve({ data: updateData, error: null }) };
          return upd;
        },
      };
      return chain;
    },
  }),
}));

import { diffResultFields, hasResultChanged, highlightlyMayWrite, syncResults, type MatchResultFields } from "./results";

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
    matchStatus = "SCHEDULED";
    matchExtras = {};
    updateData = [{ id: "m1" }];
    nbaTracked = false;
  });

  it("signale finishedNow quand un match passe à FINISHED", async () => {
    getMatchesByDate.mockResolvedValue({ data: [raw(1)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.finishedNow).toEqual(["m1"]);
  });

  it("ne signale pas finishedNow si le match était déjà FINISHED (score corrigé)", async () => {
    matchStatus = "FINISHED";
    getMatchesByDate.mockResolvedValue({ data: [raw(1)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.changed).toBe(1);
    expect(r.finishedNow).toEqual([]);
  });

  it("refuse la régression d'un match FINISHED vers IN_PROGRESS (statut Highlightly inconnu)", async () => {
    matchStatus = "FINISHED";
    const unknown = { ...raw(1), state: { description: "Weird", score: { homeTeam: [25, 25, 25, 25], awayTeam: [20, 20, 20, 20] } } };
    getMatchesByDate.mockResolvedValue({ data: [unknown], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(updates).toHaveLength(0);
    expect(r.skipped[0].reason).toContain("régression");
  });

  it("écriture concurrente : ignoré, pas de finishedNow", async () => {
    updateData = [];
    getMatchesByDate.mockResolvedValue({ data: [raw(1)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.changed).toBe(0);
    expect(r.finishedNow).toEqual([]);
    expect(r.skipped[0].reason).toContain("concurrente");
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

describe("highlightlyMayWrite", () => {
  it.each([
    ["suivi NBA, IN_PROGRESS -> IN_PROGRESS (score différent)", "IN_PROGRESS", "IN_PROGRESS", true, false],
    ["suivi NBA, FINISHED -> FINISHED (quarts différents)", "FINISHED", "FINISHED", true, false],
    ["suivi NBA, SCHEDULED -> IN_PROGRESS", "SCHEDULED", "IN_PROGRESS", true, true],
    ["suivi NBA, IN_PROGRESS -> FINISHED (repli)", "IN_PROGRESS", "FINISHED", true, true],
    ["suivi NBA, SCHEDULED -> FINISHED (repli)", "SCHEDULED", "FINISHED", true, true],
    ["non suivi, IN_PROGRESS -> IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS", false, true],
    ["non suivi, FINISHED -> FINISHED (correction de score)", "FINISHED", "FINISHED", false, true],
  ])("%s", (_label, before, next, owned, expected) => {
    expect(highlightlyMayWrite(before, next, owned)).toBe(expected);
  });
});

describe("syncResults — match suivi par le poller NBA", () => {
  beforeEach(() => {
    getMatchesByDate.mockReset();
    updates.length = 0;
    competitionType = "PLAYOFFS";
    matchExtras = {};
    updateData = [{ id: "m1" }];
    nbaTracked = true;
  });

  it("à statut égal, ne réécrit pas scores ni quarts : compté dans deferredToNba", async () => {
    matchStatus = "IN_PROGRESS";
    getMatchesByDate.mockResolvedValue({ data: [{ ...raw(1), state: { description: "In progress", score: { homeTeam: [25, 10], awayTeam: [20, 12] } } }], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(updates).toHaveLength(0);
    expect(r.deferredToNba).toBe(1);
    expect(r.changed + r.unchanged + r.skipped.length).toBe(0);
  });

  it("repli : Highlightly termine le match quand le poller ne l'a pas fait", async () => {
    matchStatus = "IN_PROGRESS";
    getMatchesByDate.mockResolvedValue({ data: [raw(1)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.finishedNow).toEqual(["m1"]);
    expect(r.deferredToNba).toBe(0);
  });

  it("un FINISHED déjà posé n'est plus corrigé par Highlightly", async () => {
    matchStatus = "FINISHED";
    getMatchesByDate.mockResolvedValue({ data: [raw(1)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(updates).toHaveLength(0);
    expect(r.deferredToNba).toBe(1);
  });
});

describe("syncResults — pas de réécriture inutile", () => {
  it("FINISHED identique stocké dans l'ordre jsonb {awayTeam, homeTeam} : unchanged, aucune écriture", async () => {
    nbaTracked = false;
    matchStatus = "FINISHED";
    matchExtras = { home_score: 100, away_score: 80, went_to_ot: false, quarter_scores: { awayTeam: [20, 20, 20, 20], homeTeam: [25, 25, 25, 25] } };
    updates.length = 0;
    getMatchesByDate.mockResolvedValue({ data: [raw(1)], requestsRemaining: 5 });
    const r = await syncResults(DAY);
    expect(r.unchanged).toBe(1);
    expect(r.changed).toBe(0);
    expect(updates).toHaveLength(0);
  });
});

describe("diffResultFields / hasResultChanged", () => {
  const base: MatchResultFields = { status: "FINISHED", home_score: 100, away_score: 80, went_to_ot: false, quarter_scores: { homeTeam: [25, 25, 25, 25], awayTeam: [20, 20, 20, 20] } };

  it("ignore l'ordre des clés de quarter_scores", () => {
    const reordered = { ...base, quarter_scores: { awayTeam: [20, 20, 20, 20], homeTeam: [25, 25, 25, 25] } };
    expect(hasResultChanged(base, reordered)).toBe(false);
    expect(diffResultFields(base, reordered)).toEqual([]);
  });

  it("détecte un quart différent, une prolongation en plus, ou null contre objet", () => {
    expect(diffResultFields(base, { ...base, quarter_scores: { homeTeam: [25, 25, 25, 24], awayTeam: [20, 20, 20, 20] } })).toEqual(["quarter_scores"]);
    expect(diffResultFields(base, { ...base, quarter_scores: { homeTeam: [25, 25, 25, 25, 5], awayTeam: [20, 20, 20, 20, 5] } })).toEqual(["quarter_scores"]);
    expect(diffResultFields(base, { ...base, quarter_scores: null })).toEqual(["quarter_scores"]);
    expect(diffResultFields({ ...base, quarter_scores: null }, { ...base, quarter_scores: null })).toEqual([]);
  });

  it("liste exactement les champs qui diffèrent", () => {
    expect(diffResultFields(base, { ...base, status: "IN_PROGRESS", home_score: 90, went_to_ot: true })).toEqual(["status", "home_score", "went_to_ot"]);
  });
});

describe("diffResultFields — jsonb incomplet", () => {
  it("quarter_scores sans awayTeam en base : différent, sans exception", () => {
    const base: MatchResultFields = { status: "FINISHED", home_score: 1, away_score: 0, went_to_ot: false, quarter_scores: { homeTeam: [1], awayTeam: [0] } };
    const broken = { ...base, quarter_scores: { homeTeam: [1] } as unknown as MatchResultFields["quarter_scores"] };
    expect(diffResultFields(broken, base)).toEqual(["quarter_scores"]);
  });
});
