// Justification affichée au joueur à la résolution d'un pari « stat joueur » :
// la vraie valeur du joueur, pour comprendre pourquoi le pari est perdu/gagné.

import { describe, it, expect } from "vitest";
import { formatActualStatReason, type BoxScoreRow } from "./resolveBetsShared";

function box(overrides: Partial<BoxScoreRow> = {}): BoxScoreRow {
  return {
    minutes: "30:00", pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0, ftm: 0, fta: 0,
    fgm: 0, fga: 0, fg3a: 0, oreb: 0, plus_minus: 0, technical_fouls: 0, tov: 0,
    ...overrides,
  };
}

describe("formatActualStatReason", () => {
  it("points : « a marqué N points » (pari à 15 pts perdu avec 10)", () => {
    expect(formatActualStatReason("Joel Embiid", "pts", box({ pts: 10 }))).toBe("Joel Embiid a marqué 10 points.");
  });

  it("autres stats comptées : « a terminé avec N … »", () => {
    expect(formatActualStatReason("Nikola Jokic", "reb", box({ reb: 14 }))).toBe("Nikola Jokic a terminé avec 14 rebonds.");
  });

  it("+/- négatif conservé", () => {
    expect(formatActualStatReason("Jayson Tatum", "plus_minus", box({ plus_minus: -7 }))).toBe(
      "Jayson Tatum a terminé avec -7 +/-."
    );
  });

  it("valeur nulle en base lue comme 0", () => {
    expect(formatActualStatReason("Jayson Tatum", "stl", box({ stl: null }))).toBe("Jayson Tatum a terminé avec 0 interceptions.");
  });

  it("minutes : décimale française, arrondie au dixième", () => {
    expect(formatActualStatReason("Luka Doncic", "min", box({ minutes: "34:30" }))).toBe("Luka Doncic a joué 34,5 minutes.");
  });

  it("pourcentage : pct arrondi + réussis/tentés", () => {
    expect(formatActualStatReason("Stephen Curry", "fg3", box({ fg3m: 5, fg3a: 11 }))).toBe(
      "Stephen Curry a terminé à 45 % à 3-points (5/11)."
    );
    expect(formatActualStatReason("Stephen Curry", "ft", box({ ftm: 0, fta: 0 }))).toBe(
      "Stephen Curry a terminé à 0 % aux lancers francs (0/0)."
    );
  });

  it("double-double : catégories à 10+ et détail", () => {
    expect(formatActualStatReason("Anthony Davis", "dd", box({ pts: 22, reb: 11, ast: 4 }))).toBe(
      "Anthony Davis a atteint 10 ou plus dans 2 catégories (22 pts, 11 reb, 4 pd, 0 int, 0 ct)."
    );
  });

  it("faute technique : singulier / pluriel", () => {
    expect(formatActualStatReason("Draymond Green", "tech", box({ technical_fouls: 1 }))).toBe(
      "Draymond Green a écopé de 1 faute technique."
    );
    expect(formatActualStatReason("Draymond Green", "tech", box({ technical_fouls: 0 }))).toBe(
      "Draymond Green a écopé de 0 faute technique."
    );
  });

  it("nom absent : « Le joueur »", () => {
    expect(formatActualStatReason(null, "pts", box({ pts: 3 }))).toBe("Le joueur a marqué 3 points.");
  });
});
