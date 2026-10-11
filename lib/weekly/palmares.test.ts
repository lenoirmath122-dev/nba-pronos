import { describe, it, expect } from "vitest";
import { formatWeekEndLabel, summarizePalmares, FALLBACK_COMPETITION_NAME } from "./palmares";

const names = new Map([
  ["cup", "NBA Cup"],
  ["season", "Saison régulière"],
]);

const own = (competition_id: string, week_end_date: string, points = 10) => ({ competition_id, week_end_date, points });

describe("summarizePalmares", () => {
  it("compte une victoire par ligne, une semaine partagée incluse", () => {
    const result = summarizePalmares({
      own: [own("cup", "2026-10-26"), own("cup", "2026-11-02")],
      sameWeekRows: [
        { competition_id: "cup", week_end_date: "2026-10-26" },
        { competition_id: "cup", week_end_date: "2026-10-26" },
        { competition_id: "cup", week_end_date: "2026-11-02" },
      ],
      competitionNames: names,
    });
    expect(result.total).toBe(2);
  });

  it("marque co-champion quand deux lignes partagent compétition et semaine", () => {
    const { weeks } = summarizePalmares({
      own: [own("cup", "2026-10-26")],
      sameWeekRows: [
        { competition_id: "cup", week_end_date: "2026-10-26" },
        { competition_id: "cup", week_end_date: "2026-10-26" },
      ],
      competitionNames: names,
    });
    expect(weeks[0].isCoChampion).toBe(true);
  });

  it("ne marque pas co-champion quand la même date est dans une autre compétition", () => {
    const { weeks } = summarizePalmares({
      own: [own("cup", "2026-10-26")],
      sameWeekRows: [
        { competition_id: "cup", week_end_date: "2026-10-26" },
        { competition_id: "season", week_end_date: "2026-10-26" },
      ],
      competitionNames: names,
    });
    expect(weeks[0].isCoChampion).toBe(false);
  });

  it("compte deux victoires pour deux compétitions la même semaine", () => {
    const result = summarizePalmares({
      own: [own("cup", "2026-10-26"), own("season", "2026-10-26")],
      sameWeekRows: [],
      competitionNames: names,
    });
    expect(result.total).toBe(2);
  });

  it("trie par date décroissante puis par nom de compétition", () => {
    const { weeks } = summarizePalmares({
      own: [own("season", "2026-10-26"), own("cup", "2026-11-09"), own("cup", "2026-10-26")],
      sameWeekRows: [],
      competitionNames: names,
    });
    expect(weeks.map((w) => `${w.weekEndDate} ${w.competitionName}`)).toEqual([
      "2026-11-09 NBA Cup",
      "2026-10-26 NBA Cup",
      "2026-10-26 Saison régulière",
    ]);
  });

  it("replie sur un nom neutre quand la compétition est inconnue", () => {
    const { weeks } = summarizePalmares({
      own: [own("ghost", "2026-10-26")],
      sameWeekRows: [],
      competitionNames: names,
    });
    expect(weeks[0].competitionName).toBe(FALLBACK_COMPETITION_NAME);
  });

  it("n'affiche aucun co-champion quand la lecture des semaines a échoué (null)", () => {
    const { weeks } = summarizePalmares({ own: [own("cup", "2026-10-26")], sameWeekRows: null, competitionNames: names });
    expect(weeks[0].isCoChampion).toBe(false);
  });

  it("renvoie un total de 0 sans victoire", () => {
    expect(summarizePalmares({ own: [], sameWeekRows: [], competitionNames: names })).toEqual({ total: 0, weeks: [] });
  });
});

describe("formatWeekEndLabel", () => {
  it("affiche jour, mois court et année (octobre)", () => {
    expect(formatWeekEndLabel("2026-10-12")).toMatch(/12 oct\.? 2026/);
  });

  it("affiche l'année en janvier et en décembre", () => {
    expect(formatWeekEndLabel("2027-01-04")).toMatch(/4 janv\.? 2027/);
    expect(formatWeekEndLabel("2026-12-28")).toMatch(/28 déc\.? 2026/);
  });
});
