import { describe, it, expect } from "vitest";
import { estimateLeadsPeriodResultProba } from "./periodStatCodes";

// Couvre estimateLeadsPeriodResultProba() (GAPS_OUVERTS.md, "formulation
// période sans le mot 'temps'", 06/09/2026) -- taux de base historiques
// pour Q1/Q3 (usage informatif seulement, jamais une proba pour
// auto-validation/auto-résolution, cf. structureAndScoreBet.ts).

describe("estimateLeadsPeriodResultProba", () => {
  it.each([
    ["Q1", "OVER", 0.664],
    ["Q1", "UNDER", 0.336],
    ["Q3", "OVER", 0.825],
    ["Q3", "UNDER", 0.175],
    ["Q4", "OVER", 1],
    ["Q4", "UNDER", 0],
    ["H2", "OVER", 1],
    ["H2", "UNDER", 0],
  ] as const)("%s/%s -> %s", (period, comparison, expected) => {
    expect(estimateLeadsPeriodResultProba(period, comparison)).toBe(expected);
  });

  it.each(["H1", "Q2"] as const)("%s -> null (vrai modèle utilisé, pas cette voie)", (period) => {
    expect(estimateLeadsPeriodResultProba(period, "OVER")).toBeNull();
    expect(estimateLeadsPeriodResultProba(period, "UNDER")).toBeNull();
  });

  it("un retournement est un événement plus rare plus tard dans le match", () => {
    const losesQ1 = estimateLeadsPeriodResultProba("Q1", "UNDER")!;
    const losesQ3 = estimateLeadsPeriodResultProba("Q3", "UNDER")!;
    expect(losesQ3).toBeLessThan(losesQ1);
  });
});
