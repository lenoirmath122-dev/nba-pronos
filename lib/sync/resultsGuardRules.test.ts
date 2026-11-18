import { describe, expect, it } from "vitest";
import { buildGuardPush, lateWindow, type GuardMatch } from "./resultsGuardRules";

const NOW = new Date("2026-11-18T08:10:00Z");
const TEAMS = new Map([
  ["h", "LAL"],
  ["a", "BOS"],
]);

function match(scheduledAt: string, status = "SCHEDULED"): GuardMatch {
  return { id: scheduledAt, status, scheduled_at: scheduledAt, home_team_id: "h", away_team_id: "a" };
}

describe("lateWindow", () => {
  it("coup d'envoi entre 36 h et 3 h 30 avant maintenant", () => {
    expect(lateWindow(NOW)).toEqual({ from: "2026-11-16T20:10:00.000Z", to: "2026-11-18T04:40:00.000Z" });
  });
});

describe("buildGuardPush", () => {
  it("rien à dire : null", () => {
    expect(buildGuardPush([], [], TEAMS, NOW)).toBeNull();
  });

  it("score rattrapé : la VM est à regarder (cas du 18/11/2026)", () => {
    const push = buildGuardPush([match("2026-11-18T04:00:00Z")], [], TEAMS, NOW);
    expect(push?.title).toBe("Score rattrapé par le secours");
    expect(push?.body).toContain("BOS @ LAL");
    expect(push?.body).toContain("4 h après le coup d'envoi");
    expect(push?.body).toContain("nba-refresh");
  });

  it("toujours sans score : l'alerte prime sur le rattrapage", () => {
    const push = buildGuardPush([match("2026-11-18T03:00:00Z")], [match("2026-11-18T04:00:00Z", "IN_PROGRESS")], TEAMS, NOW);
    expect(push?.title).toBe("Match sans score");
    expect(push?.body).toContain("coup d'envoi il y a 4 h");
  });

  it("plus de push « sans score » au-delà de 7 h (pas une alerte par heure pendant 36 h)", () => {
    expect(buildGuardPush([], [match("2026-11-18T00:30:00Z")], TEAMS, NOW)).toBeNull();
  });

  it("équipe inconnue : point d'interrogation, pas d'exception", () => {
    const push = buildGuardPush([{ ...match("2026-11-18T04:00:00Z"), home_team_id: null }], [], TEAMS, NOW);
    expect(push?.body).toContain("BOS @ ?");
  });
});
