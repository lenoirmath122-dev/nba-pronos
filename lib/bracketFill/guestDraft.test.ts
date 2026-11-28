import { describe, expect, it } from "vitest";
import type { CascadeSeriesRow } from "./cascade";
import {
  applyGuestPick,
  bracketDraftKey,
  parseBracketDraft,
  picksInSaveOrder,
  prunePicks,
  serializeBracketDraft,
} from "./guestDraft";

// Mini NBA Cup : 4 quarts (q1..q4) → 2 demies (s1, s2) → finale (f).
function row(id: string, round: string, next: string | null, slot: number | null, t1: string | null = null, t2: string | null = null): CascadeSeriesRow {
  return { id, round, next_series_id: next, next_series_slot: slot, team1_id: t1, team2_id: t2 };
}
// Ordre volontairement mélangé : l'ordre d'enregistrement ne doit pas en dépendre.
const SERIES: CascadeSeriesRow[] = [
  row("f", "CUP_FINAL", null, null),
  row("s2", "CUP_SEMIS", "f", 1),
  row("q3", "CUP_QUARTERS", "s2", 0, "E", "F"),
  row("q1", "CUP_QUARTERS", "s1", 0, "A", "B"),
  row("s1", "CUP_SEMIS", "f", 0),
  row("q4", "CUP_QUARTERS", "s2", 1, "G", "H"),
  row("q2", "CUP_QUARTERS", "s1", 1, "C", "D"),
];
const FULL = { q1: "A", q2: "C", q3: "E", q4: "G", s1: "A", s2: "G", f: "A" };
const NOW = Date.parse("2026-11-28T12:00:00Z");

describe("brouillon dans le navigateur", () => {
  it("aller-retour, clé par compétition", () => {
    const raw = serializeBracketDraft("cup", FULL, NOW);
    expect(parseBracketDraft(raw, "cup", NOW)).toEqual(FULL);
    expect(parseBracketDraft(raw, "autre", NOW)).toEqual({});
    expect(bracketDraftKey("cup")).not.toBe(bracketDraftKey("autre"));
  });

  it("illisible, trop vieux ou mal formé : vide", () => {
    expect(parseBracketDraft("{oups", "cup", NOW)).toEqual({});
    expect(parseBracketDraft(serializeBracketDraft("cup", FULL, NOW - 8 * 24 * 3600 * 1000), "cup", NOW)).toEqual({});
    expect(
      parseBracketDraft(JSON.stringify({ competitionId: "cup", updatedAt: NOW, picks: { q1: 3, q2: "C" } }), "cup", NOW)
    ).toEqual({ q2: "C" });
  });
});

describe("cascade locale", () => {
  it("un choix en amont qui change fait tomber l'aval incompatible", () => {
    const after = applyGuestPick(SERIES, FULL, "q1", "B", "NBA_CUP");
    expect(after).toEqual({ q1: "B", q2: "C", q3: "E", q4: "G", s2: "G" });
  });

  it("un changement compatible garde l'aval", () => {
    expect(applyGuestPick(SERIES, FULL, "q2", "D", "NBA_CUP")).toEqual({ ...FULL, q2: "D" });
  });

  it("série inconnue ou vainqueur hors candidats : retiré", () => {
    expect(prunePicks(SERIES, { q1: "Z", zz: "A", q2: "C" }, "NBA_CUP")).toEqual({ q2: "C" });
  });
});

describe("ordre d'enregistrement", () => {
  const ROUNDS = [
    { series: [{ seriesId: "q1" }, { seriesId: "q2" }, { seriesId: "q3" }, { seriesId: "q4" }] },
    { series: [{ seriesId: "s1" }, { seriesId: "s2" }] },
    { series: [{ seriesId: "f" }] },
  ];

  it("quarts, puis demies, puis finale, quel que soit l'ordre du brouillon", () => {
    const shuffled = { f: "A", s2: "G", q3: "E", s1: "A", q1: "A", q4: "G", q2: "C" };
    expect(picksInSaveOrder(ROUNDS, shuffled).map((p) => p.seriesId)).toEqual(["q1", "q2", "q3", "q4", "s1", "s2", "f"]);
  });

  it("séries inconnues ignorées", () => {
    expect(picksInSaveOrder(ROUNDS, { zz: "A", q1: "A" })).toEqual([{ seriesId: "q1", winnerTeamId: "A" }]);
  });
});
