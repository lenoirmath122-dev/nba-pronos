import { describe, expect, it } from "vitest";
import { countWords, wordStatus } from "./words";

describe("countWords", () => {
  it("espaces multiples et retours à la ligne", () => {
    expect(countWords("  un   deux\ntrois ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("un jeton vaut un mot", () => {
    expect(countWords("bravo {{u:11111111-1111-4111-8111-111111111111}} !")).toBe(3);
  });
});

describe("wordStatus", () => {
  it.each([
    [8, 8, "ok"],
    [9, 8, "ok"],
    [10, 8, "warn"],
    [12, 8, "warn"],
    [13, 8, "error"],
    [54, 45, "ok"],
    [55, 45, "warn"],
    [67, 45, "warn"],
    [68, 45, "error"],
  ] as const)("%i mots pour %i : %s", (count, limit, expected) => {
    expect(wordStatus(count, limit)).toBe(expected);
  });
});
