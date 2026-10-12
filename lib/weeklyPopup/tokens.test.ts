import { describe, expect, it } from "vitest";
import { detokenize, extractTokenUserIds, tokenize, type TokenUserInfo } from "./tokens";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("tokenize", () => {
  it("remplace une mention exacte par son jeton", () => {
    expect(tokenize("Bravo @Max, belle semaine.", [{ userId: A, pseudo: "Max" }])).toBe(
      `Bravo {{u:${A}}}, belle semaine.`,
    );
  });

  it("@max n'est pas @maxime (fin de pseudo)", () => {
    const set = [{ userId: A, pseudo: "max" }];
    expect(tokenize("@maxime a vu juste", set)).toBe("@maxime a vu juste");
    expect(tokenize("@max-2 aussi", set)).toBe("@max-2 aussi");
  });

  it("prend la plus longue correspondance", () => {
    const set = [
      { userId: A, pseudo: "Rillettes" },
      { userId: B, pseudo: "Rillettes-31" },
    ];
    expect(tokenize("@Rillettes-31 et @Rillettes", set)).toBe(`{{u:${B}}} et {{u:${A}}}`);
  });

  it("gère les pseudos avec espaces et la casse/accents normalisés", () => {
    const set = [
      { userId: A, pseudo: "Le Boss" },
      { userId: B, pseudo: "Élodie" },
    ];
    expect(tokenize("@Le Boss, @elodie.", set)).toBe(`{{u:${A}}}, {{u:${B}}}.`);
  });

  it("préfère l'exact ; désactive la normalisation si deux pseudos se confondent", () => {
    const set = [
      { userId: A, pseudo: "Zoe" },
      { userId: B, pseudo: "zoé" },
    ];
    expect(tokenize("@Zoe @zoé @ZOE", set)).toBe(`{{u:${A}}} {{u:${B}}} @ZOE`);
  });

  it("laisse un @ inconnu et ignore les identifiants non-uuid", () => {
    expect(tokenize("@Inconnu", [{ userId: A, pseudo: "Max" }])).toBe("@Inconnu");
    expect(tokenize("@Max", [{ userId: "pas-un-uuid", pseudo: "Max" }])).toBe("@Max");
  });
});

describe("tokenize : robustesse (revue PR 2)", () => {
  it("retire un jeton déjà présent dans le texte entrant", () => {
    expect(tokenize(`voir {{u:${C}}} ok {{u:n-importe-quoi}}`, [{ userId: A, pseudo: "Max" }])).toBe("voir  ok ");
  });

  it("apparie NFD/NFC dans les deux sens sans laisser d'accent orphelin", () => {
    const nfc = "Zoé";
    const nfd = "Zoé";
    expect(tokenize(`bravo @${nfd} !`, [{ userId: A, pseudo: nfc }])).toBe(`bravo {{u:${A}}} !`);
    expect(tokenize(`bravo @${nfc} !`, [{ userId: A, pseudo: nfd }])).toBe(`bravo {{u:${A}}} !`);
  });

  it("apparie une ligature par la normalisation", () => {
    expect(tokenize("@fin", [{ userId: A, pseudo: "ﬁn" }])).toBe(`{{u:${A}}}`);
  });
});

describe("detokenize", () => {
  const users = new Map<string, TokenUserInfo>([
    [A, { pseudo: "Max", popupMentionsOptOut: false }],
    [B, { pseudo: "Discret", popupMentionsOptOut: true }],
  ]);

  it("résout pseudo, refus, compte supprimé et jeton supprime", () => {
    const text = `{{u:${A}}} / {{u:${B}}} / {{u:${C}}} / {{u:supprime}}`;
    expect(detokenize(text, users)).toBe("@Max / un joueur discret / un ancien joueur / un ancien joueur");
  });

  it("aller-retour avec tokenize", () => {
    const t = tokenize("Salut @Max !", [{ userId: A, pseudo: "Max" }]);
    expect(detokenize(t, users)).toBe("Salut @Max !");
  });

  it("un pseudo qui imite un jeton est neutralisé", () => {
    const u = new Map<string, TokenUserInfo>([[A, { pseudo: `{{u:${B}}}`, popupMentionsOptOut: false }]]);
    const out = detokenize(`{{u:${A}}}`, u);
    expect(out).not.toContain("{{u:");
    expect(extractTokenUserIds(out)).toEqual([]);
  });

  it("un pseudo contenant un motif de remplacement reste littéral", () => {
    const u = new Map<string, TokenUserInfo>([[A, { pseudo: "a$&b", popupMentionsOptOut: false }]]);
    expect(detokenize(`{{u:${A}}}`, u)).toBe("@a$&b");
  });
});

describe("extractTokenUserIds", () => {
  it("liste les ids cités sans doublon ni supprime", () => {
    expect(extractTokenUserIds(`{{u:${A}}} {{u:${A}}} {{u:supprime}} {{u:${B}}}`)).toEqual([A, B]);
  });
});
