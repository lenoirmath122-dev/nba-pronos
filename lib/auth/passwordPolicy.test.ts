import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/auth/passwordPolicy";

describe("passwordPolicyError", () => {
  it("rejette un mot de passe trop court", () => {
    expect(passwordPolicyError("Abc123")).toBe(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  });

  it("rejette un mot de passe assez long mais purement numérique", () => {
    expect(passwordPolicyError("1234567890")).toBe("Le mot de passe doit contenir au moins une lettre et un chiffre.");
  });

  it("rejette un mot de passe assez long mais purement alphabétique", () => {
    expect(passwordPolicyError("abcdefghij")).toBe("Le mot de passe doit contenir au moins une lettre et un chiffre.");
  });

  it("accepte un mot de passe assez long avec lettres et chiffres", () => {
    expect(passwordPolicyError("motdepasse1")).toBeNull();
  });
});
