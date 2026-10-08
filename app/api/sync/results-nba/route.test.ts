import { describe, it, expect, vi, beforeEach } from "vitest";

const syncResultsFromNba = vi.fn();
const resolveAll = vi.fn();
const writeSyncLog = vi.fn();
let authorized = true;
let afterCallbacks: Array<() => Promise<void>> = [];

vi.mock("next/server", async (importActual) => ({
  ...(await importActual<typeof import("next/server")>()),
  after: (cb: () => Promise<void>) => afterCallbacks.push(cb),
}));
vi.mock("@/lib/sync/auth", () => ({ isAuthorizedSyncRequest: () => authorized }));
vi.mock("@/lib/sync/logging", () => ({ writeSyncLog: (...args: unknown[]) => writeSyncLog(...args) }));
vi.mock("@/lib/supabase/service", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/lib/sync/resultsNba", () => ({ syncResultsFromNba: (p: unknown) => syncResultsFromNba(p) }));
vi.mock("@/lib/ai/resolveCalculableBets", () => ({ resolveAllCalculableBets: () => resolveAll() }));

import { POST } from "./route";

const validBody = {
  source: "NBA_CDN_SCOREBOARD",
  games: [
    {
      gameId: "0012600001",
      gameStatus: 3,
      gameStatusText: "Final",
      period: 4,
      gameTimeUTC: "2026-10-08T00:00:00Z",
      homeTeam: { teamTricode: "LAL", score: 100, periods: [{ period: 1, score: 100 }] },
      awayTeam: { teamTricode: "GSW", score: 80, periods: [{ period: 1, score: 80 }] },
    },
  ],
};
const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/sync/results-nba", { method: "POST", body, headers });

beforeEach(() => {
  authorized = true;
  afterCallbacks = [];
  syncResultsFromNba.mockReset();
  resolveAll.mockReset();
  writeSyncLog.mockReset();
  syncResultsFromNba.mockResolvedValue({ changed: 0, unchanged: 0, unmapped: 0, skipped: [], finishedNow: [], dryRun: false, dryRunDiffs: [], noActiveCompetition: false });
});

describe("POST /api/sync/results-nba", () => {
  it("401 sans autorisation, sans rien exécuter", async () => {
    authorized = false;
    const res = await POST(req(JSON.stringify(validBody)));
    expect(res.status).toBe(401);
    expect(syncResultsFromNba).not.toHaveBeenCalled();
  });

  it("413 si content-length dépasse 64 Ko", async () => {
    const res = await POST(req("{}", { "content-length": String(70 * 1024) }));
    expect(res.status).toBe(413);
  });

  it("400 sur JSON invalide", async () => {
    const res = await POST(req("pas du json"));
    expect(res.status).toBe(400);
  });

  it("400 sur corps ne respectant pas le schéma", async () => {
    const res = await POST(req(JSON.stringify({ source: "AUTRE", games: [] })));
    expect(res.status).toBe(400);
    expect(syncResultsFromNba).not.toHaveBeenCalled();
  });

  it("200 sans finishedNow : pas de résolution des paris", async () => {
    const res = await POST(req(JSON.stringify(validBody)));
    expect(res.status).toBe(200);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("finishedNow non vide : planifie la résolution des paris via after()", async () => {
    syncResultsFromNba.mockResolvedValue({ changed: 1, unchanged: 0, unmapped: 0, skipped: [], finishedNow: ["m1"], dryRun: false, dryRunDiffs: [], noActiveCompetition: false });
    const res = await POST(req(JSON.stringify(validBody)));
    expect(res.status).toBe(200);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(resolveAll).toHaveBeenCalledTimes(1);
  });

  it("502 générique si le writer échoue", async () => {
    syncResultsFromNba.mockRejectedValue(new Error("boom"));
    const res = await POST(req(JSON.stringify(validBody)));
    expect(res.status).toBe(502);
  });

  it("dryRun : le sync_log reprend les champs qui auraient été écrits", async () => {
    syncResultsFromNba.mockResolvedValue({
      changed: 1, unchanged: 0, unmapped: 0, skipped: [], finishedNow: [], dryRun: true, noActiveCompetition: false,
      dryRunDiffs: [{ gameId: "0012600001", matchId: "m1", from: "IN_PROGRESS", to: "FINISHED", fields: ["status", "home_score"] }],
    });
    const res = await POST(req(JSON.stringify({ ...validBody, dryRun: true })));
    expect(res.status).toBe(200);
    expect(writeSyncLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ summary: expect.stringContaining("Écarts : 0012600001 IN_PROGRESS>FINISHED [status,home_score]") }));
  });
});
