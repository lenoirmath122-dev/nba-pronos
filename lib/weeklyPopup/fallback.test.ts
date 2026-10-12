import { describe, expect, it } from "vitest";
import { FALLBACK_TEXTS, buildFallbackContent, championSentence, pickFallback } from "./fallback";
import { findMoneyWords } from "./money";
import { U1, U2, U3 } from "./testFixtures";
import { countWords } from "./words";

describe("FALLBACK_TEXTS", () => {
  it("5 textes dans l'ordre du §9 bis", () => {
    expect(FALLBACK_TEXTS.map((t) => t.titre)).toEqual([
      "Semaine calme au comptoir",
      "Le banc était plein",
      "Semaine sans histoire",
      "Mi-temps",
      "Temps mort",
    ]);
  });
  it("sans argent, titre <= 8 mots, cta <= 15 mots, aucun pseudo", () => {
    for (const t of FALLBACK_TEXTS) {
      expect(findMoneyWords(`${t.titre} ${t.repli} ${t.cta}`)).toEqual([]);
      expect(countWords(t.titre)).toBeLessThanOrEqual(8);
      expect(countWords(t.cta)).toBeLessThanOrEqual(15);
      expect(`${t.titre}${t.repli}${t.cta}`).not.toContain("@");
    }
  });
});

describe("pickFallback", () => {
  it.each([
    [0, 0],
    [4, 4],
    [5, 0],
    [7, 2],
  ])("%i popups de repli déjà publiées : texte %i", (count, index) => {
    expect(pickFallback(count)).toBe(index);
  });
});

describe("championSentence", () => {
  it("aucun champion : null", () => {
    expect(championSentence([])).toBeNull();
  });
  it("un champion, singulier et pluriel", () => {
    expect(championSentence([{ userId: U1, points: 1 }])).toBe(`En tête de la semaine : {{u:${U1}}} avec 1 point.`);
    expect(championSentence([{ userId: U1, points: 42 }])).toBe(`En tête de la semaine : {{u:${U1}}} avec 42 points.`);
  });
  it("ex aequo", () => {
    expect(
      championSentence([
        { userId: U1, points: 42 },
        { userId: U2, points: 42 },
      ]),
    ).toBe(`À égalité en tête : {{u:${U1}}} et {{u:${U2}}}, 42 points.`);
    expect(
      championSentence([
        { userId: U1, points: 42 },
        { userId: U2, points: 42 },
        { userId: U3, points: 42 },
      ]),
    ).toBe(`À égalité en tête : {{u:${U1}}}, {{u:${U2}}} et {{u:${U3}}}, 42 points.`);
  });
});

describe("buildFallbackContent", () => {
  it("contenu de repli : blocs null, phrase du champion", () => {
    const c = buildFallbackContent(1, [{ userId: U1, points: 10 }]);
    expect(c).toMatchObject({ titre: "Le banc était plein", top: null, flop: null, refuse: null });
    expect(c.repli).toBe(FALLBACK_TEXTS[1].repli);
    expect(c.champion).toContain(U1);
  });
});
