import { describe, expect, it } from "vitest";
import { resolveNbaCupPopup, type NbaCupSeriesRow } from "./eligibility";

const NOW = Date.parse("2026-11-28T12:00:00Z");
const DEADLINE = "2026-12-04T00:30:00Z";
const CUP = { type: "NBA_CUP" as const, bracket_deadline: DEADLINE };

function quarter(known = true): NbaCupSeriesRow {
  return { round: "CUP_QUARTERS", team1_id: known ? "a" : null, team2_id: known ? "b" : null };
}
const SEMIS: NbaCupSeriesRow[] = [
  { round: "CUP_SEMIS", team1_id: null, team2_id: null },
  { round: "CUP_SEMIS", team1_id: null, team2_id: null },
  { round: "CUP_FINAL", team1_id: null, team2_id: null },
];
const FULL = [quarter(), quarter(), quarter(), quarter(), ...SEMIS];

describe("resolveNbaCupPopup", () => {
  it("connecté, bracket vide : popup avec 0/7", () => {
    expect(resolveNbaCupPopup({ competition: CUP, series: FULL, filled: 0, nowMs: NOW })).toEqual({
      audience: "user",
      deadline: DEADLINE,
      filled: 0,
      total: 7,
    });
  });

  it("connecté, bracket partiel : avancement", () => {
    expect(resolveNbaCupPopup({ competition: CUP, series: FULL, filled: 3, nowMs: NOW })?.filled).toBe(3);
  });

  it("connecté, bracket complet : rien", () => {
    expect(resolveNbaCupPopup({ competition: CUP, series: FULL, filled: 7, nowMs: NOW })).toBeNull();
  });

  it("visiteur : popup invité sans avancement", () => {
    expect(resolveNbaCupPopup({ competition: CUP, series: FULL, filled: null, nowMs: NOW })).toEqual({
      audience: "guest",
      deadline: DEADLINE,
      filled: 0,
      total: 7,
    });
  });

  it("date limite passée : rien", () => {
    expect(
      resolveNbaCupPopup({ competition: CUP, series: FULL, filled: 0, nowMs: Date.parse(DEADLINE) })
    ).toBeNull();
  });

  it("pas de date limite, autre compétition ou pas de compétition : rien", () => {
    expect(
      resolveNbaCupPopup({ competition: { ...CUP, bracket_deadline: null }, series: FULL, filled: 0, nowMs: NOW })
    ).toBeNull();
    expect(
      resolveNbaCupPopup({ competition: { ...CUP, type: "PLAYOFFS" }, series: FULL, filled: 0, nowMs: NOW })
    ).toBeNull();
    expect(resolveNbaCupPopup({ competition: null, series: FULL, filled: null, nowMs: NOW })).toBeNull();
  });

  it("quarts pas encore tous connus : rien", () => {
    const series = [quarter(), quarter(), quarter(), quarter(false), ...SEMIS];
    expect(resolveNbaCupPopup({ competition: CUP, series, filled: null, nowMs: NOW })).toBeNull();
    expect(resolveNbaCupPopup({ competition: CUP, series: [], filled: null, nowMs: NOW })).toBeNull();
  });
});
