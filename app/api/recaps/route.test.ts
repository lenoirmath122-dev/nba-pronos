import { describe, it, expect, vi, beforeEach } from "vitest";

const order: string[] = [];
const runLeaderboardSnapshot = vi.fn();
const runRecaps = vi.fn();
const runWeeklyFreeze = vi.fn();
const ensureWeeklyPopupDraft = vi.fn();
const runCompetitionWeekName = vi.fn();
let authorized = true;

vi.mock("@/lib/sync/auth", () => ({ isAuthorizedCronRequest: () => authorized }));
vi.mock("@/lib/snapshots/leaderboardSnapshot", () => ({
  runLeaderboardSnapshot: (...a: unknown[]) => runLeaderboardSnapshot(...a),
}));
vi.mock("@/lib/recaps/sendRecaps", () => ({ runRecaps: (...a: unknown[]) => runRecaps(...a) }));
vi.mock("@/lib/weekly/freezeWeek", () => ({
  runWeeklyFreeze: (...a: unknown[]) => runWeeklyFreeze(...a),
}));

vi.mock("@/lib/weekly/competitionName", () => ({
  runCompetitionWeekName: (...a: unknown[]) => runCompetitionWeekName(...a),
}));

vi.mock("@/lib/weeklyPopup/ensure", () => ({
  ensureWeeklyPopupDraft: (...a: unknown[]) => ensureWeeklyPopupDraft(...a),
}));

import { GET } from "./route";

const req = (qs = "") => new Request(`http://localhost/api/recaps${qs}`);

beforeEach(() => {
  authorized = true;
  order.length = 0;
  runLeaderboardSnapshot.mockReset();
  runRecaps.mockReset();
  runWeeklyFreeze.mockReset();
  ensureWeeklyPopupDraft.mockReset();
  runCompetitionWeekName.mockReset();
  runCompetitionWeekName.mockImplementation(async () => {
    order.push("weekName");
    return { renamed: false, skipped: "nom inchangé ou format non reconnu" };
  });
  runLeaderboardSnapshot.mockImplementation(async () => {
    order.push("snapshot");
    return { snapshotted: 3 };
  });
  runWeeklyFreeze.mockImplementation(async () => {
    order.push("weekly");
    return { frozen: false, skipped: "classement hebdo désactivé" };
  });
  ensureWeeklyPopupDraft.mockImplementation(async () => {
    order.push("popup");
    return { action: "none", weekEnd: "2026-10-26", reason: "popup désactivée" };
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

  it("fige le snapshot, puis la semaine, renomme, assure la popup, avant les récaps", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(order).toEqual(["snapshot", "weekly", "weekName", "popup", "recaps"]);
    expect(await res.json()).toEqual({
      snapshot: { snapshotted: 3 },
      weekly: { frozen: false, skipped: "classement hebdo désactivé" },
      weekName: { renamed: false, skipped: "nom inchangé ou format non reconnu" },
      popup: { action: "none", weekEnd: "2026-10-26", reason: "popup désactivée" },
      recaps: { notified: 1, candidates: 1 },
    });
  });

  it("un renommage en échec ne bloque pas les récaps (500)", async () => {
    runCompetitionWeekName.mockRejectedValue(new Error("lecture impossible"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(runRecaps).toHaveBeenCalled();
    expect((await res.json()).weekName).toEqual({ error: "lecture impossible" });
  });

  it("un figement hebdo en échec ne bloque pas les récaps (500)", async () => {
    runWeeklyFreeze.mockRejectedValue(new Error("migration absente"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(runRecaps).toHaveBeenCalled();
    expect((await res.json()).weekly).toEqual({ error: "migration absente" });
  });

  it("une popup en échec ne bloque pas les récaps (500), message d'erreur seul", async () => {
    ensureWeeklyPopupDraft.mockRejectedValue(new Error("migration 20261013090000 poussée ?"));
    const res = await GET(req());
    expect(res.status).toBe(500);
    expect(runRecaps).toHaveBeenCalled();
    expect((await res.json()).popup).toEqual({ error: "migration 20261013090000 poussée ?" });
  });

  it("l'échéance de la génération part du début de la requête (+ 270 s)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T09:00:00Z"));
    try {
      await GET(req());
    } finally {
      vi.useRealTimers();
    }
    const [, options] = ensureWeeklyPopupDraft.mock.calls[0];
    expect(options).toEqual({ trigger: "CRON", deadlineMs: Date.parse("2026-10-26T09:00:00Z") + 270_000 });
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
