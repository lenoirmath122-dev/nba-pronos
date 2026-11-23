import { describe, it, expect } from "vitest";
import { chatDayKey, chatDayLabel } from "./dayLabel";

// 23/11/2026, 10 h à Paris (09:00 UTC).
const NOW = new Date("2026-11-23T09:00:00.000Z");

describe("chatDayLabel", () => {
  it("aujourd'hui et hier, au fuseau de Paris", () => {
    expect(chatDayLabel("2026-11-23T06:00:00.000Z", NOW)).toBe("Aujourd'hui");
    // 22/11 à 23 h 30 UTC = 23/11 à 0 h 30 à Paris : déjà aujourd'hui.
    expect(chatDayLabel("2026-11-22T23:30:00.000Z", NOW)).toBe("Aujourd'hui");
    expect(chatDayLabel("2026-11-22T12:00:00.000Z", NOW)).toBe("Hier");
  });

  it("jour de la semaine et date au-delà, année si différente", () => {
    expect(chatDayLabel("2026-11-17T12:00:00.000Z", NOW)).toBe("Mardi 17 novembre");
    expect(chatDayLabel("2025-12-31T12:00:00.000Z", NOW)).toBe("Mercredi 31 décembre 2025");
  });

  it("clé de jour stable", () => {
    expect(chatDayKey("2026-11-22T23:30:00.000Z")).toBe("2026-11-23");
  });
});
