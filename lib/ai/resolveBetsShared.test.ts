import { describe, it, expect } from "vitest";
import { computeOutcome, countingStatValue, rowStatValue, statSelectColumns, type BoxScoreRow } from "./resolveBetsShared";

function box(overrides: Partial<BoxScoreRow> = {}): BoxScoreRow {
  return {
    minutes: "30:00", pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0, ftm: 0, fta: 0,
    fgm: 0, fga: 0, fg3a: 0, oreb: 0, plus_minus: 0, technical_fouls: 0, tov: 0, pf: 0,
    ...overrides,
  };
}

describe("stats composées (Lot 1 S1)", () => {
  it("dreb = reb - oreb, null si une des deux manque", () => {
    expect(countingStatValue("dreb", box({ reb: 11, oreb: 3 }))).toBe(8);
    expect(countingStatValue("dreb", box({ reb: null }))).toBeNull();
  });

  it("fgm / ftm / fta / pf lisent leur colonne", () => {
    const b = box({ fgm: 9, ftm: 6, fta: 7, pf: 4 });
    expect(countingStatValue("fgm", b)).toBe(9);
    expect(countingStatValue("ftm", b)).toBe(6);
    expect(countingStatValue("fta", b)).toBe(7);
    expect(countingStatValue("pf", b)).toBe(4);
  });

  it("computeOutcome : égalité au seuil = perdu pour OVER, pf null = non résolu", () => {
    expect(computeOutcome("dreb", 8, "OVER", box({ reb: 11, oreb: 3 }))).toBe(false);
    expect(computeOutcome("dreb", 7, "OVER", box({ reb: 11, oreb: 3 }))).toBe(true);
    expect(computeOutcome("pf", 3, "OVER", box({ pf: null }))).toBeNull();
  });

  it("statSelectColumns / rowStatValue pour les sommes combo et duel", () => {
    expect(statSelectColumns("dreb")).toBe("reb, oreb");
    expect(statSelectColumns("min")).toBe("minutes");
    expect(statSelectColumns("pf")).toBe("pf");
    expect(rowStatValue("dreb", { reb: 10, oreb: 4 })).toBe(6);
    expect(rowStatValue("min", { minutes: "12:30" })).toBe(12.5);
    expect(rowStatValue("pf", { pf: null })).toBe(0);
  });
});
