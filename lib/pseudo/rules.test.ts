import { describe, expect, it } from "vitest";
import { normalizePseudo, pseudoLengthError } from "@/lib/pseudo/rules";

describe("pseudoLengthError", () => {
  it("accepte 3 à 20 caractères", () => {
    expect(pseudoLengthError("abc")).toBeNull();
    expect(pseudoLengthError("a".repeat(20))).toBeNull();
  });
  it("refuse trop court ou trop long", () => {
    expect(pseudoLengthError("ab")).not.toBeNull();
    expect(pseudoLengthError("a".repeat(21))).not.toBeNull();
  });
  it("compte les caractères, pas les unités UTF-16", () => {
    expect(pseudoLengthError("🏀".repeat(3))).toBeNull();
  });
});

describe("normalizePseudo", () => {
  it("retire les espaces autour", () => {
    expect(normalizePseudo("  Math  ")).toBe("Math");
  });
});
