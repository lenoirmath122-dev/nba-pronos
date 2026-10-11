import { describe, it, expect, vi, beforeEach } from "vitest";

const order: string[] = [];
const runLeaderboardSnapshot = vi.fn();
const runRecaps = vi.fn();
const runWeeklyFreeze = vi.fn();
let authorized = true;

vi.mock("@/lib/sync/auth", () => ({ isAuthorizedCronRequest: () => authorized }));
vi.mock("@/lib/snapshots/leaderboardSnapshot", () => ({
  runLeaderboardSnapshot: (...a: unknown[]) => runLeaderboardSnapshot(...a),
}));
vi.mock("@/lib/recaps/sendRecaps", () => ({ runRecaps: (...a: unknown[]) => runRecaps(...a) }));
vi.mock("@/lib/weekly/freezeWeek", () => ({
  runWeeklyFreeze: (...a: unknown[]) => runWeeklyFreeze(...a),
}));

import { GET } from "./route";

const req = (qs = "") => new Request(`http://localhost/api/recaps${qs}`);

beforeEach(() => {
  authorized = true;
  order.length = 0;
  runLeaderboardSnapshot.mockReset();
  runRecaps.mockReset();
  runWeeklyFreeze.mockReset();
  runLeaderboardSnapshot.mockImplementation(async () => {
    order.push("snapshot");
    return { snapshotted: 3 };
  });
  runWeeklyFreeze.mockImplementation(async () => {
    order.push("weekly");
    return { frozen: false, skipped: "classement hebdo désactivé" };
  });
  runRecaps.mockImplementation(async () => {
    order.push("recaps");
    return { notified: 1, candidates: 1 };
  });
});

describe("GET /api/recaps", () => {
  it("401 sans autorisation, rien n'est exécuté", async () => {
    authorized = false;
    expect((await GET(req())).status).toBe(401);
    expect(runLeaderboardSnapshot).not.toHaveBeenCalled();
    expect(runRecaps).not.toHaveBeenCalled();
  });

  it("fige le snapshot, puis la semaine, avant les récaps", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(order).toEqual(["snapshot", "weekly", "recaps"]);
    expect(await res.json()).toEqual({
      snapshot: { snapshotted: 3 },
      weekly: { frozen: false, skipped: "classement hebdo désactivé" },
      recaps: { notified: 1, candidates: 1 },
    });
  });

  it("un figement hebdo en échec ne bloque pas les récaps (500)", async () => {
    runWeeklyFreeze.mockRejectedValue(new Error("migration absente"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(runRecaps).toHaveBeenCalled();
    expect((await res.json()).weekly).toEqual({ error: "migration absente" });
  });

  it("un snapshot en échec ne bloque pas les récaps (500)", async () => {
    runLeaderboardSnapshot.mockRejectedValue(new Error("boom"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(runRecaps).toHaveBeenCalled();
    expect((await res.json()).snapshot).toEqual({ error: "boom" });
  });

  it("des récaps en échec n'empêchent pas le snapshot (500)", async () => {
    runRecaps.mockRejectedValue(new Error("push KO"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(runLeaderboardSnapshot).toHaveBeenCalled();
  });

  it("ne transmet ni force ni only_owner au snapshot", async () => {
    await GET(req("?force=1"));
    expect(runLeaderboardSnapshot.mock.calls[0]).toHaveLength(1);
    expect(runWeeklyFreeze.mock.calls[0]).toHaveLength(1);
    expect(runRecaps).toHaveBeenCalledWith(expect.any(Number), { force: true, onlyUserId: undefined });
  });
});
