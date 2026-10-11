import { describe, it, expect, vi, beforeEach } from "vitest";

const runLeaderboardSnapshot = vi.fn();
let authorized = true;

vi.mock("@/lib/sync/auth", () => ({ isAuthorizedCronRequest: () => authorized }));
vi.mock("@/lib/snapshots/leaderboardSnapshot", () => ({
  runLeaderboardSnapshot: (...a: unknown[]) => runLeaderboardSnapshot(...a),
}));

import { POST } from "./route";

const req = (qs = "") =>
  new Request(`http://localhost/api/snapshots/leaderboard${qs}`, { method: "POST" });

beforeEach(() => {
  authorized = true;
  runLeaderboardSnapshot.mockReset();
  runLeaderboardSnapshot.mockResolvedValue({ snapshotted: 2 });
});

describe("POST /api/snapshots/leaderboard", () => {
  it("401 sans autorisation", async () => {
    authorized = false;
    expect((await POST(req())).status).toBe(401);
    expect(runLeaderboardSnapshot).not.toHaveBeenCalled();
  });

  it("transmet force=1", async () => {
    await POST(req("?force=1"));
    expect(runLeaderboardSnapshot).toHaveBeenCalledWith(expect.any(Number), { force: true });
    await POST(req());
    expect(runLeaderboardSnapshot).toHaveBeenLastCalledWith(expect.any(Number), { force: false });
  });

  it("500 avec le message d'erreur", async () => {
    runLeaderboardSnapshot.mockRejectedValue(new Error("column not found"));
    const res = await POST(req());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "column not found" });
  });
});
