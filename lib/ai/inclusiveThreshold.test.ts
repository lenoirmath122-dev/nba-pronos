import { describe, expect, it } from "vitest";
import { applyInclusiveThreshold } from "./inclusiveThreshold";

describe("applyInclusiveThreshold", () => {
  it("OVER inclusif : N devient N-1", () => {
    expect(applyInclusiveThreshold(25, "OVER", true, ["pts"])).toBe(24);
  });
  it("UNDER inclusif : N devient N+1", () => {
    expect(applyInclusiveThreshold(3, "UNDER", true, ["stl"])).toBe(4);
  });
  it("non inclusif : inchangé", () => {
    expect(applyInclusiveThreshold(25, "OVER", false, ["pts"])).toBe(25);
    expect(applyInclusiveThreshold(25, "OVER", undefined, ["pts"])).toBe(25);
  });
  it("seuil ou comparaison null : inchangé", () => {
    expect(applyInclusiveThreshold(null, "OVER", true, ["dd"])).toBeNull();
    expect(applyInclusiveThreshold(5, null, true, ["pts"])).toBe(5);
  });
  it("pourcentages et minutes : inchangés", () => {
    expect(applyInclusiveThreshold(0.5, "OVER", true, ["fg"])).toBe(0.5);
    expect(applyInclusiveThreshold(30, "OVER", true, ["min"])).toBe(30);
    expect(applyInclusiveThreshold(1, "OVER", true, ["pts", "fg3"])).toBe(1);
  });
  it("seuil non entier : inchangé", () => {
    expect(applyInclusiveThreshold(24.5, "OVER", true, ["pts"])).toBe(24.5);
  });
  it("somme de stats entières (PRA)", () => {
    expect(applyInclusiveThreshold(45, "OVER", true, ["pts", "reb", "ast"])).toBe(44);
  });
});
