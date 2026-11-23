import { describe, expect, it } from "vitest";
import { isNbaCupPrizeVisible } from "./nbaCupPrize";

describe("isNbaCupPrizeVisible", () => {
  it("visible avant et pendant le jeu", () => {
    expect(isNbaCupPrizeVisible(new Date("2026-11-24T10:00:00Z"))).toBe(true);
    expect(isNbaCupPrizeVisible(new Date("2027-01-15T12:00:00Z"))).toBe(true);
  });
  it("visible jusqu'au 31/01/2027 23:59 heure de Paris", () => {
    expect(isNbaCupPrizeVisible(new Date("2027-01-31T22:58:00Z"))).toBe(true);
    expect(isNbaCupPrizeVisible(new Date("2027-01-31T22:59:00Z"))).toBe(true);
  });
  it("masqué dès 00:00 le 01/02/2027 heure de Paris", () => {
    expect(isNbaCupPrizeVisible(new Date("2027-01-31T23:00:00Z"))).toBe(false);
    expect(isNbaCupPrizeVisible(new Date("2027-03-01T00:00:00Z"))).toBe(false);
  });
});
