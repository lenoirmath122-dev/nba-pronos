import { describe, expect, it } from "vitest";
import { probaToDifficulty } from "./difficultyTiers";

describe("probaToDifficulty", () => {
  it("place chaque proba dans son palier", () => {
    expect(probaToDifficulty(0.9)).toBe(1);
    expect(probaToDifficulty(0.664)).toBe(1);
    expect(probaToDifficulty(0.6)).toBe(2);
    expect(probaToDifficulty(0.529)).toBe(2);
    expect(probaToDifficulty(0.45)).toBe(3);
    expect(probaToDifficulty(0.35)).toBe(3);
    expect(probaToDifficulty(0.3)).toBe(4);
    expect(probaToDifficulty(0.2)).toBe(4);
    expect(probaToDifficulty(0.19)).toBe(5);
    expect(probaToDifficulty(0)).toBe(5);
  });

  it("un pari à 39 % vaut le palier 3 (15 points), plus le palier 4", () => {
    expect(probaToDifficulty(0.39)).toBe(3);
  });

  it("borne les probas hors de [0, 1]", () => {
    expect(probaToDifficulty(1.2)).toBe(1);
    expect(probaToDifficulty(-0.1)).toBe(5);
  });
});
