import { describe, expect, it } from "vitest";
import { countBareMentions, scanMentions } from "./mentions";
import { U1, U2, U3 } from "./testFixtures";

const set = (...pseudos: string[]) =>
  pseudos.map((pseudo, i) => ({ userId: [U1, U2, U3][i], pseudo }));

describe("scanMentions", () => {
  it("@max n'est pas @maxime", () => {
    const scan = scanMentions("bravo @maxime", set("max"));
    expect(scan.hits.find((h) => h.userId)).toBeUndefined();
    expect(scan.unknownCount).toBe(1);
  });

  it("apparie @Rillettes-31 plutôt que @Rillettes", () => {
    const scan = scanMentions("@Rillettes-31 et @Rillettes", set("Rillettes", "Rillettes-31"));
    expect(scan.hits.map((h) => h.userId)).toEqual([U2, U1]);
    expect(scan.unknownCount).toBe(0);
  });

  it("pseudo à espaces", () => {
    expect(scanMentions("salut @Le Boss !", set("Le Boss")).hits[0].userId).toBe(U1);
  });

  it("deux pseudos qui se confondent après normalisation : exact seulement", () => {
    const closed = set("Zoé", "Zoe");
    expect(scanMentions("@Zoé", closed).hits[0].userId).toBe(U1);
    expect(scanMentions("@ZOE", closed).hits[0].userId).toBeNull();
  });

  it("normalisation NFKD quand elle est univoque", () => {
    expect(scanMentions("@zoe", set("Zoé")).hits[0].userId).toBe(U1);
  });

  it("@ inconnu compté ; @ isolé ou « 20 @ 30 » non compté", () => {
    expect(scanMentions("@inconnu", set("Nico")).unknownCount).toBe(1);
    expect(scanMentions("@ seul", set("Nico")).unknownCount).toBe(0);
    expect(scanMentions("20 @ 30", set("Nico")).unknownCount).toBe(0);
  });

  it("jeton entrant compté et ignoré", () => {
    const scan = scanMentions(`voilà {{u:${U1}}} @Nico`, set("Nico"));
    expect(scan.incomingTokens).toBe(1);
    expect(scan.hits[0].userId).toBe(U1);
  });
});

describe("scanMentions : pseudos à symbole initial", () => {
  it("@🏀Jordan hors ensemble fermé est compté", () => {
    expect(scanMentions("bravo @🏀Jordan", set("Nico")).unknownCount).toBe(1);
    expect(scanMentions("bravo @-X", set("Nico")).unknownCount).toBe(1);
  });
  it("pseudo à symbole initial dans l'ensemble : apparié", () => {
    expect(scanMentions("bravo @🏀Jordan !", set("🏀Jordan")).hits[0].userId).toBe(U1);
  });
});

describe("countBareMentions", () => {
  it("pseudo cité sans @ : compté ; avec @ : non", () => {
    expect(countBareMentions("Maxime a fait 40 points", set("Maxime"))).toBe(1);
    expect(countBareMentions("@Maxime a fait 40 points", set("Maxime"))).toBe(0);
  });
  it("bornes de mot, accents et casse", () => {
    expect(countBareMentions("maximement bien", set("Maxime"))).toBe(0);
    expect(countBareMentions("Zoé est en tête", set("Zoe "))).toBe(1);
  });
  it("pseudos de moins de 3 lettres ignorés ; jeton ignoré", () => {
    expect(countBareMentions("Al est là", set("Al"))).toBe(0);
    expect(countBareMentions(`{{u:${U1}}} Nico`, set("Nico"))).toBe(1);
  });
});
