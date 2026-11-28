import { describe, expect, it } from "vitest";
import {
  closedStorageKey,
  formatTimeLeft,
  isNbaCupPopupHidden,
  nextParisMidnightMs,
  snoozeStorageKey,
} from "./dismissal";

describe("nextParisMidnightMs", () => {
  it("hiver (UTC+1) : demain 00:00 Paris = 23:00 UTC la veille", () => {
    const now = Date.parse("2026-11-28T15:00:00Z");
    expect(new Date(nextParisMidnightMs(now)).toISOString()).toBe("2026-11-28T23:00:00.000Z");
  });

  it("juste après minuit Paris : c'est bien le lendemain, pas dans quelques minutes", () => {
    const now = Date.parse("2026-11-28T23:05:00Z"); // 29/11 00:05 à Paris
    expect(new Date(nextParisMidnightMs(now)).toISOString()).toBe("2026-11-29T23:00:00.000Z");
  });

  it("été (UTC+2)", () => {
    const now = Date.parse("2026-07-10T08:00:00Z");
    expect(new Date(nextParisMidnightMs(now)).toISOString()).toBe("2026-07-10T22:00:00.000Z");
  });
});

describe("isNbaCupPopupHidden", () => {
  const nowMs = Date.parse("2026-11-28T15:00:00Z");
  const base = { disabled: false, snoozedUntil: null, closedThisSession: false, nowMs };

  it("rien de posé : visible", () => {
    expect(isNbaCupPopupHidden(base)).toBe(false);
  });

  it("coupe-circuit e2e ou croix dans cette visite : masquée", () => {
    expect(isNbaCupPopupHidden({ ...base, disabled: true })).toBe(true);
    expect(isNbaCupPopupHidden({ ...base, closedThisSession: true })).toBe(true);
  });

  it("« plus tard » : masquée jusqu'à l'échéance, puis revient", () => {
    const until = String(nowMs + 1000);
    expect(isNbaCupPopupHidden({ ...base, snoozedUntil: until })).toBe(true);
    expect(isNbaCupPopupHidden({ ...base, snoozedUntil: until, nowMs: nowMs + 1000 })).toBe(false);
  });

  it("valeur stockée illisible : visible", () => {
    expect(isNbaCupPopupHidden({ ...base, snoozedUntil: "n'importe quoi" })).toBe(false);
  });
});

describe("clés de stockage", () => {
  it("distinctes entre visiteur et connecté", () => {
    expect(snoozeStorageKey("guest")).not.toBe(snoozeStorageKey("user"));
    expect(closedStorageKey("guest")).not.toBe(closedStorageKey("user"));
  });
});

describe("formatTimeLeft", () => {
  it("jours, heures, minutes", () => {
    expect(formatTimeLeft((5 * 24 + 4) * 3_600_000 + 60_000)).toBe("5 j 4 h");
    expect(formatTimeLeft(5 * 3_600_000 + 12 * 60_000)).toBe("5 h 12 min");
    expect(formatTimeLeft(12 * 60_000)).toBe("12 min");
    expect(formatTimeLeft(10_000)).toBe("1 min");
  });
});
