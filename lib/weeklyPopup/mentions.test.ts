import { describe, expect, it } from "vitest";
import { scanMentions } from "./mentions";
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
