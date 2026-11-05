import { describe, expect, it } from "vitest";
import { buildWeeklyPoints, mondayOf } from "./weeklyPoints";

const totals = (entries: Record<string, number>) => new Map(Object.entries(entries));

describe("mondayOf", () => {
  it("ramène n'importe quel jour au lundi de sa semaine", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // mercredi
    expect(mondayOf("2026-11-02")).toBe("2026-11-02"); // lundi
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // dimanche
  });
});

describe("buildWeeklyPoints", () => {
  const weeks = [
    { weekStart: "2026-10-26", totals: totals({ me: 10, a: 20, b: 5 }) },
    { weekStart: "2026-11-02", totals: totals({ me: 25, a: 24, b: 5 }) },
  ];

  it("calcule les points de chaque semaine par différence de totaux", () => {
    const rows = buildWeeklyPoints("me", weeks, "2026-11-02");
    expect(rows.map((r) => r.points)).toEqual([10, 15]);
    expect(rows.map((r) => r.cumulative)).toEqual([10, 25]);
  });

  it("classe dans la portée, ex-aequo à égalité de rang", () => {
    const rows = buildWeeklyPoints("me", weeks, "2026-11-02");
    expect(rows.map((r) => r.rank)).toEqual([2, 1]);
  });

  it("donne la moyenne de la portée et repère la semaine en cours", () => {
    const rows = buildWeeklyPoints("me", weeks, "2026-11-02");
    expect(rows[1].scopeAverage).toBe(6.3); // (15 + 4 + 0) / 3 arrondi à 0,1
    expect(rows[0].isCurrent).toBe(false);
    expect(rows[1].isCurrent).toBe(true);
  });

  it("ignore les semaines où le joueur n'a pas encore de total", () => {
    const rows = buildWeeklyPoints("me", [{ weekStart: "2026-10-19", totals: totals({ a: 3 }) }, ...weeks], "2026-11-02");
    expect(rows).toHaveLength(2);
    expect(rows[0].points).toBe(10);
  });
});
