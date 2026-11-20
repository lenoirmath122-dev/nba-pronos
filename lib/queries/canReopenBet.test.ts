import { describe, expect, it } from "vitest";
import { canReopenBet, isBetStillModifiable } from "./canReopenBet";

describe("canReopenBet", () => {
  it("autorise un pari validé, deadline ouverte, jamais rouvert", () => {
    expect(canReopenBet("VALIDATED", true, false)).toBe(true);
  });
  it("refuse si déjà rouvert", () => {
    expect(canReopenBet("VALIDATED", true, true)).toBe(false);
  });
  it("refuse une fois la deadline passée", () => {
    expect(canReopenBet("VALIDATED", false, false)).toBe(false);
  });
  it.each(["DRAFT", "SUBMITTED", "REJECTED", "WON", "LOST", "CANCELLED"])("refuse le statut %s", (s) => {
    expect(canReopenBet(s, true, false)).toBe(false);
  });
});

describe("isBetStillModifiable (paris des autres cachés)", () => {
  it.each(["SUBMITTED", "VALIDATED"])("%s, deadline ouverte, jamais rouvert : modifiable", (s) => {
    expect(isBetStillModifiable(s, true, false)).toBe(true);
  });
  it("figé une fois la modification consommée", () => {
    expect(isBetStillModifiable("VALIDATED", true, true)).toBe(false);
    expect(isBetStillModifiable("SUBMITTED", true, true)).toBe(false);
  });
  it("figé une fois la deadline passée", () => {
    expect(isBetStillModifiable("VALIDATED", false, false)).toBe(false);
  });
  it.each(["DRAFT", "REJECTED", "WON", "LOST", "CANCELLED"])("pas concerné : %s", (s) => {
    expect(isBetStillModifiable(s, true, false)).toBe(false);
  });
});
