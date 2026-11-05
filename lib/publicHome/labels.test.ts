import { describe, it, expect } from "vitest";
import { matchKicker, remainingLabel, frenchTime, dayTimeLabel, deadlineLabel } from "./labels";

describe("matchKicker", () => {
  it("nuit : match à 1h Paris dans la journée", () => {
    // match 21/10 1h00 Paris (20/10 23:00Z), vu le 20/10 à 18h Paris
    expect(matchKicker("2026-10-20T23:00:00Z", Date.parse("2026-10-20T16:00:00Z"))).toBe("Match de cette nuit · 1h00");
  });

  it("soir : match à 20h30 le même jour", () => {
    expect(matchKicker("2026-10-20T18:30:00Z", Date.parse("2026-10-20T10:00:00Z"))).toBe("Match de ce soir · 20h30");
  });

  it("au-delà de 24 h : jour de la semaine", () => {
    expect(matchKicker("2026-10-22T23:30:00Z", Date.parse("2026-10-20T10:00:00Z"))).toBe("Vendredi · 1h30");
  });
});

describe("remainingLabel / frenchTime", () => {
  it("formate la durée restante", () => {
    expect(remainingLabel((15 * 60 + 42) * 60_000)).toBe("15 h 42 min");
    expect(remainingLabel(9 * 60_000)).toBe("9 min");
    expect(remainingLabel(50 * 3600_000)).toBe("2 j 2 h");
  });

  it("formate l'heure française", () => {
    expect(frenchTime(Date.parse("2026-10-20T23:00:00Z"))).toBe("1h00");
  });
});

describe("dayTimeLabel", () => {
  const NOW = Date.parse("2026-10-20T16:00:00Z"); // 18h Paris, mardi
  it("soirée du jour, y compris après minuit", () => {
    expect(dayTimeLabel("2026-10-20T18:30:00Z", NOW)).toBe("Ce soir 20h30");
    expect(dayTimeLabel("2026-10-20T23:00:00Z", NOW)).toBe("Ce soir 1h00");
  });
  it("autre jour : jour de la semaine abrégé, heure de Paris", () => {
    expect(dayTimeLabel("2026-10-22T01:30:00Z", NOW)).toBe("Jeu. 3h30");
    expect(dayTimeLabel("2026-10-21T18:30:00Z", NOW)).toBe("Mer. 20h30");
  });
});

describe("deadlineLabel", () => {
  const NOW = Date.parse("2026-10-20T16:00:00Z");
  it("dans les 24 h : l'heure seule", () => {
    expect(deadlineLabel("2026-10-20T23:00:00Z", NOW)).toBe("1h00");
  });
  it("au-delà : jour et heure", () => {
    expect(deadlineLabel("2026-10-22T01:30:00Z", NOW)).toBe("jeu. 3h30");
  });
});
