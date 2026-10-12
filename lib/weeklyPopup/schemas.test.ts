import { describe, expect, it } from "vitest";
import { ClassifierOutputSchema, RedacteurOutputSchema, isVerdictCoherent } from "./schemas";

const valid = {
  titre: "Une semaine",
  champion: null,
  top: "Bravo",
  flop: null,
  refuse: null,
  cta: "Joue",
  paris_cites: { top: ["t1"], flop: [], refuse: [] },
};

describe("RedacteurOutputSchema", () => {
  it("accepte une sortie valide", () => {
    expect(RedacteurOutputSchema.safeParse(valid).success).toBe(true);
  });

  it("refuse une clé en trop, un id mal formé, un doublon, une chaîne vide", () => {
    const cites = (top: string[]) => ({ ...valid, paris_cites: { ...valid.paris_cites, top } });
    expect(RedacteurOutputSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(RedacteurOutputSchema.safeParse(cites(["x1"])).success).toBe(false);
    expect(RedacteurOutputSchema.safeParse(cites(["t1", "t1"])).success).toBe(false);
    expect(RedacteurOutputSchema.safeParse({ ...valid, top: "" }).success).toBe(false);
  });

  it("borne les longueurs et le nombre d'ids", () => {
    expect(RedacteurOutputSchema.safeParse({ ...valid, titre: "x".repeat(101) }).success).toBe(false);
    const nine = Array.from({ length: 9 }, (_, i) => `t${i + 1}`);
    expect(RedacteurOutputSchema.safeParse({ ...valid, paris_cites: { ...valid.paris_cites, top: nine } }).success).toBe(false);
  });
});

describe("ClassifierOutputSchema", () => {
  it("accepte des verdicts ok et bloque", () => {
    const r = ClassifierOutputSchema.safeParse({
      verdicts: [
        { id: "t1", verdict: "ok", categorie: null },
        { id: "c1", verdict: "bloque", categorie: "doute" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("refuse verdict ou catégorie inconnus, liste vide", () => {
    expect(ClassifierOutputSchema.safeParse({ verdicts: [{ id: "t1", verdict: "peut-etre", categorie: null }] }).success).toBe(false);
    expect(ClassifierOutputSchema.safeParse({ verdicts: [{ id: "t1", verdict: "bloque", categorie: "autre" }] }).success).toBe(false);
    expect(ClassifierOutputSchema.safeParse({ verdicts: [] }).success).toBe(false);
  });

  it("isVerdictCoherent : catégorie NULL si et seulement si ok", () => {
    expect(isVerdictCoherent({ id: "t1", verdict: "ok", categorie: null })).toBe(true);
    expect(isVerdictCoherent({ id: "t1", verdict: "ok", categorie: "doute" })).toBe(false);
    expect(isVerdictCoherent({ id: "t1", verdict: "bloque", categorie: null })).toBe(false);
    expect(isVerdictCoherent({ id: "t1", verdict: "bloque", categorie: "racisme" })).toBe(true);
  });
});
