// T-EDGE-02 (audit/BACKLOG_TESTS.md §5, feuille de route p1-4) : rang
// PARTAGÉ (1, 2, 2, 4 -- le rang suivant SAUTE) quand 3+ joueurs sont
// strictement à égalité sur les 4 critères de départage.

import { describe, it, expect } from "vitest";
import { assignRanks, type RankableScore } from "./ranking";

function score(user_id: string, overrides: Partial<RankableScore> = {}): RankableScore {
  return {
    user_id,
    total_points: 10,
    correct_match_winners: 5,
    exact_margins: 2,
    bracket_points: 3,
    ...overrides,
  };
}

describe("assignRanks — ex-aequo sur tous les critères", () => {
  it("3 joueurs strictement égaux → rang 1, 2, 2, puis le 4e saute à 4", () => {
    const ranks = assignRanks([score("a"), score("b"), score("c"), score("d", { total_points: 5 })]);

    // a/b/c partagent le même rang (ordre d'entrée sans importance entre eux,
    // le tri est stable sur une égalité totale) -- exactement UN rang "2" et
    // UN rang "1" attribués à 3 joueurs, jamais 1/2/3.
    const tied = [ranks.get("a"), ranks.get("b"), ranks.get("c")].sort((x, y) => x! - y!);
    expect(tied[0]).toBe(1);
    expect(tied[1]).toBe(tied[0]);
    expect(tied[2]).toBe(tied[0]);
    // Le rang suivant SAUTE à 4 (pas 2) -- 3 joueurs occupent les rangs 1-2-3.
    expect(ranks.get("d")).toBe(4);
  });

  it("aucune égalité → rangs strictement croissants 1, 2, 3", () => {
    const ranks = assignRanks([
      score("a", { total_points: 30 }),
      score("b", { total_points: 20 }),
      score("c", { total_points: 10 }),
    ]);
    expect(ranks.get("a")).toBe(1);
    expect(ranks.get("b")).toBe(2);
    expect(ranks.get("c")).toBe(3);
  });

  it("total_points égal mais départagé par correct_match_winners", () => {
    const ranks = assignRanks([
      score("a", { total_points: 10, correct_match_winners: 3 }),
      score("b", { total_points: 10, correct_match_winners: 5 }),
    ]);
    expect(ranks.get("b")).toBe(1); // plus de bons vainqueurs → devant, malgré total_points identique.
    expect(ranks.get("a")).toBe(2);
  });
});
