import { describe, expect, it } from "vitest";
import { daysBetween, daySeed, filterCandidates, makeRng, pickCandidate, validateRange, type DrawMatch } from "./draw";

const teams = new Map([
  ["1", "t-bos"],
  ["2", "t-nyk"],
  ["3", "t-lal"],
  ["4", "t-gsw"],
]);
const isScheduled = (d: string) => d === "Scheduled";

// 2026-10-21T00:00Z = 20/10 20h à New York (EDT) : bien le jour NY 2026-10-20.
function m(id: number, home: string, away: string, date = "2026-10-21T00:00:00.000Z", status = "Scheduled"): DrawMatch {
  return { id, date, statusDescription: status, homeRef: home, awayRef: away };
}
const ctx = (over = {}) => ({ day: "2026-10-20", teamIdByRef: teams, mappedMatchRefs: new Set<string>(), isScheduled, ...over });

describe("makeRng / daySeed", () => {
  it("même graine -> même suite", () => {
    const a = makeRng("abc");
    const b = makeRng("abc");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("graines différentes -> suites différentes", () => {
    expect(makeRng("abc")()).not.toBe(makeRng("abd")());
  });
  it("la graine d'un jour dépend du jour", () => {
    expect(daySeed("run", "2026-10-20")).toBe(daySeed("run", "2026-10-20"));
    expect(daySeed("run", "2026-10-20")).not.toBe(daySeed("run", "2026-10-21"));
  });
});

describe("filterCandidates", () => {
  it("garde un match valide du bon jour NY", () => {
    expect(filterCandidates([m(10, "1", "2")], ctx()).map((c) => c.id)).toEqual([10]);
  });
  it("écarte équipe non mappée, statut non SCHEDULED, id déjà mappé, mauvais jour", () => {
    const raw = [
      m(1, "1", "99"),
      m(2, "1", "2", undefined, "Finished"),
      m(3, "1", "2"),
      m(4, "3", "4", "2026-10-22T00:00:00.000Z"),
      m(5, "3", "4"),
    ];
    const out = filterCandidates(raw, ctx({ mappedMatchRefs: new Set(["3"]) }));
    expect(out.map((c) => c.id)).toEqual([5]);
  });
  it("trie par id croissant quel que soit l'ordre de l'API et dédoublonne", () => {
    const out = filterCandidates([m(30, "1", "2"), m(10, "3", "4"), m(30, "1", "2")], ctx());
    expect(out.map((c) => c.id)).toEqual([10, 30]);
  });
});

describe("pickCandidate", () => {
  const cands = filterCandidates([m(1, "1", "2"), m(2, "3", "4"), m(3, "1", "3")], ctx());
  it("jour vide -> null", () => expect(pickCandidate([], "s")).toBeNull());
  it("reproductible avec la même graine", () => {
    expect(pickCandidate(cands, "seed")).toEqual(pickCandidate(cands, "seed"));
  });
  it("l'index est toujours dans les bornes", () => {
    for (let i = 0; i < 200; i++) {
      const p = pickCandidate(cands, `s${i}`)!;
      expect(p.index).toBeGreaterThanOrEqual(0);
      expect(p.index).toBeLessThan(cands.length);
    }
  });
});

describe("validateRange", () => {
  const none = () => false;
  it("lot valide", () => expect(validateRange("2026-10-20", "2026-10-29", none)).toEqual([]));
  it("11 jours -> refusé", () => expect(validateRange("2026-10-20", "2026-10-30", none)).toHaveLength(1));
  it("avant le premier jour -> refusé", () => expect(validateRange("2026-10-19", "2026-10-21", none).length).toBeGreaterThan(0));
  it("après le dernier jour -> refusé", () => expect(validateRange("2026-11-26", "2026-11-28", none).length).toBeGreaterThan(0));
  it("from > to -> refusé", () => expect(validateRange("2026-10-25", "2026-10-21", none).length).toBeGreaterThan(0));
  it("jour déjà publié -> refusé", () => {
    expect(validateRange("2026-10-20", "2026-10-22", (d) => d === "2026-10-21")[0]).toContain("2026-10-21");
  });
  it("daysBetween traverse la bascule de mois", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});
