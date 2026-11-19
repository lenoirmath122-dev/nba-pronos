import { describe, expect, it } from "vitest";
import { canReopenBet } from "./canReopenBet";

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
