import { describe, it, expect } from "vitest";
import { matchKicker, remainingLabel, frenchTime } from "./labels";

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
