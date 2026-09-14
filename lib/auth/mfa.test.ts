import { describe, expect, it } from "vitest";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/auth/mfa";

describe("generateRecoveryCodes", () => {
  it("génère 10 codes uniques au format XXXX-XXXX", () => {
    const { codes } = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/);
    }
  });

  it("fait correspondre chaque hash à son code en clair", () => {
    const { codes, hashes } = generateRecoveryCodes();
    codes.forEach((code, i) => {
      expect(hashes[i]).toBe(hashRecoveryCode(code));
    });
  });
});

describe("hashRecoveryCode", () => {
  it("est insensible à la casse et aux espaces autour du code", () => {
    expect(hashRecoveryCode("abcd-1234")).toBe(hashRecoveryCode(" ABCD-1234 "));
  });

  it("produit des hashs différents pour des codes différents", () => {
    expect(hashRecoveryCode("AAAA-1111")).not.toBe(hashRecoveryCode("BBBB-2222"));
  });
});
