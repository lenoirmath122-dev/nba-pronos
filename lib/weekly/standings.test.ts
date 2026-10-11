import { describe, it, expect } from "vitest";
import {
  computeWeeklyStandings,
  pickWeeklyChampions,
  resolveWeekBounds,
  weekEndFor,
  type WeeklySnapshotRow,
} from "./standings";

const row = (user_id: string, total_points: number, cw: number | null = 0, em: number | null = 0): WeeklySnapshotRow => ({
  user_id,
  total_points,
  correct_match_winners: cw,
  exact_margins: em,
});

describe("weekEndFor", () => {
  it("lundi à 10h Paris pile ferme la semaine, avant 10h non", () => {
    expect(weekEndFor(Date.parse("2026-10-19T08:00:00Z"))).toBe("2026-10-19"); // 10h CEST
    expect(weekEndFor(Date.parse("2026-10-19T07:59:00Z"))).toBe("2026-10-12");
  });

  it("traverse le changement d'heure du 25/10", () => {
    expect(weekEndFor(Date.parse("2026-10-26T08:30:00Z"))).toBe("2026-10-19"); // 9h30 CET
    expect(weekEndFor(Date.parse("2026-10-26T09:00:00Z"))).toBe("2026-10-26"); // 10h CET
    expect(weekEndFor(Date.parse("2026-10-25T23:30:00Z"))).toBe("2026-10-19"); // lundi 0h30 Paris
  });

  it("en milieu de semaine, renvoie le lundi écoulé", () => {
    expect(weekEndFor(Date.parse("2026-10-28T12:00:00Z"))).toBe("2026-10-26");
  });
});

describe("resolveWeekBounds", () => {
  const base = {
    weekEnd: "2026-10-26",
    earliestOnOrAfterEnd: "2026-10-26",
    previousFreezeEndDate: "2026-10-19",
    latestOnOrBeforeStart: "2026-10-19",
  };

  it("cas nominal", () => {
    expect(resolveWeekBounds(base)).toEqual({
      ok: true,
      start: "2026-10-19",
      end: "2026-10-26",
      endLate: false,
      baselineLate: false,
    });
  });

  it("repart de la fin réelle de la semaine précédente (rattrapage)", () => {
    expect(resolveWeekBounds({ ...base, previousFreezeEndDate: "2026-10-20" })).toMatchObject({
      ok: true,
      start: "2026-10-20",
    });
  });

  it("sans semaine précédente : dernier snapshot antérieur, signalé s'il n'est pas le lundi", () => {
    expect(resolveWeekBounds({ ...base, previousFreezeEndDate: null })).toMatchObject({
      ok: true,
      start: "2026-10-19",
      baselineLate: false,
    });
    expect(
      resolveWeekBounds({ ...base, previousFreezeEndDate: null, latestOnOrBeforeStart: "2026-10-18" }),
    ).toMatchObject({ ok: true, start: "2026-10-18", baselineLate: true });
  });

  it("snapshot de fin absent", () => {
    expect(resolveWeekBounds({ ...base, earliestOnOrAfterEnd: null })).toEqual({
      ok: false,
      reason: "snapshot de fin absent",
    });
  });

  it("fin prise en retard : endLate", () => {
    expect(resolveWeekBounds({ ...base, earliestOnOrAfterEnd: "2026-10-27" })).toMatchObject({
      ok: true,
      end: "2026-10-27",
      endLate: true,
    });
  });

  it("première semaine : aucune référence", () => {
    expect(resolveWeekBounds({ ...base, previousFreezeEndDate: null, latestOnOrBeforeStart: null })).toEqual({
      ok: false,
      reason: "première semaine (pas de snapshot de référence)",
    });
  });

  it("refuse un départ qui n'est pas antérieur à la fin", () => {
    expect(resolveWeekBounds({ ...base, previousFreezeEndDate: "2026-10-26" })).toEqual({
      ok: false,
      reason: "départ postérieur ou égal à la fin",
    });
  });

  it("semaine sautée : le départ retombe sur le dernier snapshot <= lundi n-1", () => {
    expect(
      resolveWeekBounds({ ...base, previousFreezeEndDate: null, latestOnOrBeforeStart: "2026-10-12" }),
    ).toMatchObject({ ok: true, start: "2026-10-12", baselineLate: true });
  });
});

describe("computeWeeklyStandings", () => {
  it("différence simple, rangs partagés 1,2,2,4", () => {
    const start = [row("a", 10), row("b", 10), row("c", 10), row("d", 10)];
    const end = [row("a", 30), row("b", 25), row("c", 25), row("d", 12)];
    const { standings } = computeWeeklyStandings(start, end);
    expect(standings.map((s) => [s.userId, s.points, s.rank])).toEqual([
      ["a", 20, 1],
      ["b", 15, 2],
      ["c", 15, 2],
      ["d", 2, 4],
    ]);
  });

  it("joueur absent du début : départ à 0", () => {
    const { standings } = computeWeeklyStandings([row("a", 10)], [row("a", 15), row("n", 7, 2, 1)]);
    expect(standings.find((s) => s.userId === "n")).toMatchObject({
      points: 7,
      correctMatchWinners: 2,
      exactMargins: 1,
    });
  });

  it("joueur absent de la fin : ignoré", () => {
    const { standings } = computeWeeklyStandings([row("a", 10), row("gone", 50)], [row("a", 15)]);
    expect(standings.map((s) => s.userId)).toEqual(["a"]);
  });

  it("points négatifs conservés (correction tardive)", () => {
    const { standings } = computeWeeklyStandings([row("a", 10)], [row("a", 6)]);
    expect(standings[0].points).toBe(-4);
  });

  it("égalité aux points départagée par bons vainqueurs puis écarts exacts", () => {
    const start = [row("a", 0), row("b", 0), row("c", 0)];
    const end = [row("a", 10, 2, 5), row("b", 10, 3, 0), row("c", 10, 3, 1)];
    const { standings, tiebreakAvailable } = computeWeeklyStandings(start, end);
    expect(tiebreakAvailable).toBe(true);
    expect(standings.map((s) => [s.userId, s.rank])).toEqual([
      ["c", 1],
      ["b", 2],
      ["a", 3],
    ]);
  });

  it("snapshot d'avant le lot 0 (NULL) : points seuls, égalité = rang partagé", () => {
    const start = [row("a", 0, null, null), row("b", 0, null, null)];
    const end = [row("a", 10, 4, 4), row("b", 10, 1, 0)];
    const { standings, tiebreakAvailable } = computeWeeklyStandings(start, end);
    expect(tiebreakAvailable).toBe(false);
    expect(standings.every((s) => s.rank === 1 && s.correctMatchWinners === null)).toBe(true);
  });

  it("un seul NULL désactive le départage pour tous", () => {
    const { tiebreakAvailable } = computeWeeklyStandings([row("a", 0)], [row("a", 5), row("b", 5, null, null)]);
    expect(tiebreakAvailable).toBe(false);
  });
});

describe("pickWeeklyChampions", () => {
  const standing = (userId: string, points: number, rank: number) => ({
    userId,
    points,
    rank,
    correctMatchWinners: 0,
    exactMargins: 0,
  });

  it("un champion", () => {
    expect(pickWeeklyChampions([standing("a", 9, 1), standing("b", 5, 2)]).map((s) => s.userId)).toEqual(["a"]);
  });

  it("co-champions en cas d'égalité parfaite", () => {
    expect(pickWeeklyChampions([standing("a", 9, 1), standing("b", 9, 1)])).toHaveLength(2);
  });

  it("pas de champion si le meilleur total est <= 0", () => {
    expect(pickWeeklyChampions([standing("a", 0, 1), standing("b", 0, 1)])).toEqual([]);
    expect(pickWeeklyChampions([standing("a", -3, 1)])).toEqual([]);
  });
});
