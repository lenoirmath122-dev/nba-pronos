import { describe, expect, it } from "vitest";
import { buildRankingFacts, filterRankingFacts, rankingInputLine, rankingUserIds, type RankingSnapshotRow } from "./ranking";

const row = (user_id: string, rank: number, total_points: number): RankingSnapshotRow => ({
  user_id,
  rank,
  total_points,
  correct_match_winners: null,
  exact_margins: null,
});

// Départ : a1..a6 aux rangs 1..6. Fin : points ajoutés pendant la semaine.
const start = [row("a", 1, 50), row("b", 2, 40), row("c", 3, 30), row("d", 4, 20), row("e", 5, 10), row("f", 6, 5)];
const end = [
  row("e", 1, 60), // +50, remonte de 5 à 1
  row("a", 2, 55), // +5
  row("c", 3, 50), // +20
  row("f", 4, 35), // +30
  row("d", 5, 22), // +2
  row("b", 6, 40), // +0, chute de 2 à 6
];

describe("buildRankingFacts", () => {
  it("podium, remontée, chute et lanterne rouge", () => {
    const facts = buildRankingFacts(start, end, false);
    expect(facts?.podium).toEqual([
      { userId: "e", rank: 1, points: 50 },
      { userId: "f", rank: 2, points: 30 },
      { userId: "c", rank: 3, points: 20 },
    ]);
    expect(facts?.climb).toEqual({ userId: "e", from: 5, to: 1 });
    expect(facts?.drop).toEqual({ userId: "b", from: 2, to: 6 });
    expect(facts?.last).toEqual({ userIds: ["b"], points: 0, tied: 1 });
    expect(rankingUserIds(facts)).toEqual(["e", "f", "c", "b"]);
  });

  it("aucun snapshot : null ; mouvement d'une seule place ignoré", () => {
    expect(buildRankingFacts([], end, false)).toBeNull();
    const small = buildRankingFacts([row("a", 1, 10), row("b", 2, 5)], [row("b", 1, 20), row("a", 2, 11)], true);
    expect(small?.climb).toBeNull();
    expect(small?.drop).toBeNull();
    expect(small?.last).toBeNull(); // moins de 5 joueurs
    expect(small?.inProgress).toBe(true);
  });

  it("plus de 3 ex aequo en bas : lanterne anonyme", () => {
    const s = ["a", "b", "c", "d", "e", "f"].map((id, i) => row(id, i + 1, 0));
    const e = [row("a", 1, 10), row("b", 2, 0), row("c", 2, 0), row("d", 2, 0), row("e", 2, 0), row("f", 2, 0)];
    expect(buildRankingFacts(s, e, false)?.last).toEqual({ userIds: [], points: 0, tied: 5 });
  });
});

describe("filterRankingFacts et rankingInputLine", () => {
  it("retire les joueurs non citables ; lanterne devenue anonyme", () => {
    const facts = buildRankingFacts(start, end, false);
    const filtered = filterRankingFacts(facts, (id) => id !== "b" && id !== "f");
    expect(filtered?.podium.map((p) => p.userId)).toEqual(["e", "c"]);
    expect(filtered?.drop).toBeNull();
    expect(filtered?.last).toEqual({ userIds: [], points: 0, tied: 1 });
  });

  it("ligne JSON avec pseudos préfixés, null sans faits", () => {
    expect(rankingInputLine(null, () => "x")).toBe("null");
    const line = JSON.parse(rankingInputLine(buildRankingFacts(start, end, true), (id) => id.toUpperCase()));
    expect(line.semaine_en_cours).toBe(true);
    expect(line.podium[0]).toEqual({ pseudo: "@E", rang: 1, points_semaine: 50 });
    expect(line.remontee).toEqual({ pseudo: "@E", rang_avant: 5, rang_apres: 1 });
    expect(line.lanterne_rouge).toEqual({ pseudos: ["@B"], points_semaine: 0, ex_aequo: 1 });
  });
});
