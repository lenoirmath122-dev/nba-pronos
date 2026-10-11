import { describe, it, expect } from "vitest";
import {
  countdownLabel,
  formatChampionNames,
  formatDayLabel,
  nextWeekBoundaryIso,
  resolveCurrentWeekStart,
  scoresToSnapshotRows,
} from "./currentWeek";

describe("resolveCurrentWeekStart", () => {
  const base = { weekStart: "2026-10-26", frozenEndDate: null, earliestOnOrAfterStart: null, anySnapshotBefore: false };

  it("le figement précédent est prioritaire", () => {
    expect(
      resolveCurrentWeekStart({ ...base, frozenEndDate: "2026-10-27", earliestOnOrAfterStart: "2026-10-26" }),
    ).toEqual({ ok: true, start: "2026-10-27", late: true });
  });

  it("repli sur le premier snapshot du lundi", () => {
    expect(resolveCurrentWeekStart({ ...base, earliestOnOrAfterStart: "2026-10-26", anySnapshotBefore: true })).toEqual({
      ok: true,
      start: "2026-10-26",
      late: false,
    });
  });

  it("un snapshot du mardi est utilisé mais signalé en retard", () => {
    expect(resolveCurrentWeekStart({ ...base, earliestOnOrAfterStart: "2026-10-27", anySnapshotBefore: true })).toEqual({
      ok: true,
      start: "2026-10-27",
      late: true,
    });
  });

  it("aucun snapshot du tout : départ vide", () => {
    expect(resolveCurrentWeekStart(base)).toEqual({ ok: true, start: null, late: false });
  });

  it("des snapshots plus anciens seulement : pas de repli", () => {
    expect(resolveCurrentWeekStart({ ...base, anySnapshotBefore: true })).toEqual({
      ok: false,
      reason: "snapshot de début absent",
    });
  });
});

describe("nextWeekBoundaryIso", () => {
  it("fin de semaine = lundi suivant 10h Paris (heure d'hiver : 09:00Z)", () => {
    // Mercredi 28/10/2026 : semaine du 26/10, fin le 02/11 à 10h CET.
    expect(nextWeekBoundaryIso(Date.parse("2026-10-28T10:00:00Z"))).toBe("2026-11-02T09:00:00.000Z");
  });

  it("une semaine qui traverse le passage à l'heure d'hiver (25/10/2026)", () => {
    // Mercredi 21/10 : semaine du 19/10, fin le lundi 26/10 à 10h CET = 09:00Z.
    expect(nextWeekBoundaryIso(Date.parse("2026-10-21T10:00:00Z"))).toBe("2026-10-26T09:00:00.000Z");
  });

  it("lundi 9h59 Paris appartient encore à la semaine précédente", () => {
    // 26/10 08:59Z = 09h59 CET : la semaine courante est celle du 19/10.
    expect(nextWeekBoundaryIso(Date.parse("2026-10-26T08:59:00Z"))).toBe("2026-10-26T09:00:00.000Z");
    // 10h00 pile : nouvelle semaine, fin le 02/11.
    expect(nextWeekBoundaryIso(Date.parse("2026-10-26T09:00:00Z"))).toBe("2026-11-02T09:00:00.000Z");
  });
});

describe("countdownLabel", () => {
  const end = "2026-11-02T09:00:00.000Z";
  const at = (iso: string) => countdownLabel(Date.parse(iso), end);

  it("jours et heures", () => {
    expect(at("2026-10-31T04:00:00Z")).toBe("Fin dans 2 j 5 h");
  });

  it("jours pleins", () => {
    expect(at("2026-10-31T09:00:00Z")).toBe("Fin dans 2 j");
  });

  it("heures seules", () => {
    expect(at("2026-11-02T06:00:00Z")).toBe("Fin dans 3 h");
  });

  it("moins d'une heure", () => {
    expect(at("2026-11-02T08:30:00Z")).toBe("Fin dans moins d'1 h");
  });

  it("échéance passée", () => {
    expect(at("2026-11-02T09:00:01Z")).toBe("Mise à jour imminente");
  });
});

describe("formatChampionNames", () => {
  it("un, deux, trois noms", () => {
    expect(formatChampionNames(["A"])).toBe("A");
    expect(formatChampionNames(["A", "B"])).toBe("A et B");
    expect(formatChampionNames(["A", "B", "C"])).toBe("A, B et C");
  });

  it("aucun nom", () => {
    expect(formatChampionNames([])).toBe("");
  });
});

describe("formatDayLabel", () => {
  it("jour court français", () => {
    expect(formatDayLabel("2026-10-26")).toMatch(/lun\.? 26 oct/);
  });
});

describe("scoresToSnapshotRows", () => {
  it("garde les colonnes du snapshot", () => {
    expect(
      scoresToSnapshotRows([{ user_id: "a", total_points: 5, correct_match_winners: 2, exact_margins: 1 }]),
    ).toEqual([{ user_id: "a", total_points: 5, correct_match_winners: 2, exact_margins: 1 }]);
  });
});
