import { describe, expect, it } from "vitest";
import { dailyKickoffLabel } from "./dailyMatch";

// 2026 : fin de l'heure d'été européenne le 25/10, américaine le 01/11.
// Écart NY→Paris : 6h, puis 5h du 25/10 au 31/10, puis 6h de nouveau.

describe("dailyKickoffLabel", () => {
  it("cas nominal : 19h30 NY = 01h30 Paris le lendemain", () => {
    const l = dailyKickoffLabel("2026-10-20T23:30:00Z"); // 19:30 EDT
    expect(l.dayLabel).toBe("Match du 20/10");
    expect(l.time).toBe("01:30");
    expect(l.nightLabel).toBe("dans la nuit du 20 au 21");
    expect(l.shortLabel).toBe("01:30 · nuit du 20 au 21");
  });

  it("minuit pile à Paris (écart de 5h) : sous-titre présent", () => {
    const l = dailyKickoffLabel("2026-10-27T23:00:00Z"); // 19:00 EDT = 00:00 CET
    expect(l.dayLabel).toBe("Match du 27/10");
    expect(l.time).toBe("00:00");
    expect(l.nightLabel).toBe("dans la nuit du 27 au 28");
  });

  it("23h30 à Paris : même jour, pas de sous-titre", () => {
    const l = dailyKickoffLabel("2026-10-27T22:30:00Z"); // 18:30 EDT = 23:30 CET
    expect(l.nightLabel).toBeNull();
    expect(l.shortLabel).toBe("23:30");
  });

  it("match de l'après-midi : pas de sous-titre", () => {
    const l = dailyKickoffLabel("2026-11-05T20:30:00Z"); // 15:30 EST = 21:30 CET
    expect(l.dayLabel).toBe("Match du 05/11");
    expect(l.nightLabel).toBeNull();
  });

  it("changement de mois : dates complètes", () => {
    const l = dailyKickoffLabel("2026-11-01T02:00:00Z"); // 31/10 22:00 EDT = 03:00 CET
    expect(l.dayLabel).toBe("Match du 31/10");
    expect(l.nightLabel).toBe("dans la nuit du 31/10 au 01/11");
  });

  it("après la bascule américaine : 19h EST = 01h Paris", () => {
    const l = dailyKickoffLabel("2026-11-03T00:00:00Z"); // 02/11 19:00 EST
    expect(l.dayLabel).toBe("Match du 02/11");
    expect(l.time).toBe("01:00");
    expect(l.nightLabel).toBe("dans la nuit du 02 au 03");
  });
});
