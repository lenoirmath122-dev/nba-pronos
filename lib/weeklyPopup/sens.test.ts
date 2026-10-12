import { describe, expect, it } from "vitest";
import { computeSens, isInclusiveAmbiguous, seuilEtSens } from "./sens";
import { bet } from "./testFixtures";

describe("computeSens", () => {
  it("fautes techniques : une relation = un sens", () => {
    const rel = (count_relation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN" | "EXACTLY") =>
      computeSens(bet({ structured_comparison: null, structured_technical_fouls_count: { count_relation } }));
    expect(rel("AT_LEAST")).toBe("au moins");
    expect(rel("MORE_THAN")).toBe("plus de");
    expect(rel("FEWER_THAN")).toBe("moins de");
    expect(rel("EXACTLY")).toBe("exactement");
  });

  it("QUARTERS_WON_COUNT : exactement seulement avec exact_count", () => {
    const period = (exact_count: boolean) =>
      bet({
        structured_comparison: "OVER",
        structured_period: { outcome_kind: "QUARTERS_WON_COUNT", exact_count },
      });
    expect(computeSens(period(true))).toBe("exactement");
    expect(computeSens(period(false))).toBe("plus de");
  });

  it("OVER = plus de, UNDER = moins de, sinon null", () => {
    expect(computeSens(bet({ structured_comparison: "OVER" }))).toBe("plus de");
    expect(computeSens(bet({ structured_comparison: "UNDER" }))).toBe("moins de");
    expect(computeSens(bet({ structured_comparison: null }))).toBeNull();
  });

  it("structured_negation ne produit jamais de sens", () => {
    expect(computeSens(bet({ structured_comparison: null, structured_negation: true }))).toBeNull();
  });
});

describe("règle m : formulation inclusive avec seuil entier", () => {
  const withText = (description: string, structured_threshold: number, structured_comparison: "OVER" | "UNDER" = "OVER") =>
    bet({ description, structured_threshold, structured_comparison });

  it("« au moins 25 » stocké 25 : ambigu, seuil et sens à null", () => {
    expect(seuilEtSens(withText("Shai marque au moins 25 points", 25))).toEqual({ seuil: null, sens: null });
  });
  it("même texte stocké 24,5 : conservé", () => {
    expect(seuilEtSens(withText("Shai marque au moins 25 points", 24.5))).toEqual({ seuil: 24.5, sens: "plus de" });
  });
  it.each([
    "Shai fait 25+ points",
    "Shai fait 2 ou plus de passes",
    "Shai fait au plus 4 passes",
    "Il ne fait pas plus de 3 pertes de balle",
    "Minimum 10 rebonds pour Jokic",
    "Jokic >= 10 rebonds",
  ])("ambigu : %s", (description) => {
    expect(isInclusiveAmbiguous(withText(description, 10))).toBe(true);
  });
  it.each([
    "Shai marque plus de 25 points",
    "Le match fait moins de 215 points",
    "Shai marque + de 25 points",
    "Shai fait au-dessus de 30 points",
  ])("conservé : %s", (description) => {
    expect(isInclusiveAmbiguous(withText(description, 25))).toBe(false);
  });
  it("fautes techniques « au moins 3 » : conservé, la relation est explicite", () => {
    const b = bet({
      description: "Au moins 3 fautes techniques",
      structured_threshold: 3,
      structured_comparison: null,
      structured_technical_fouls_count: { count_relation: "AT_LEAST" },
    });
    expect(seuilEtSens(b)).toEqual({ seuil: 3, sens: "au moins" });
  });
  it("seuil absent : null", () => {
    expect(seuilEtSens(bet({ structured_threshold: null }))).toEqual({ seuil: null, sens: null });
  });
});

describe("règle m : formulations inclusives supplémentaires (revue PR 3)", () => {
  it.each([
    "Il faut supérieur ou égal à 25",
    "égal ou supérieur à 25",
    "à partir de 25 points",
    "dès 25 points",
    "atteint 25 points",
    "25 points ou davantage",
    "au-moins 5 rebonds",
    "5+ de 3pts",
  ])("ambigu : %s", (description) => {
    const b = bet({ description, structured_threshold: 25, structured_comparison: "OVER" });
    expect(isInclusiveAmbiguous(b)).toBe(true);
  });
});
