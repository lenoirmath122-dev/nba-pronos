import { describe, expect, it } from "vitest";
import { mentionsForExport, toDisplayedPopup, userIdsInContent } from "./display";
import type { TokenUserInfo } from "./tokens";
import type { WeeklyPopupContent } from "./types";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

const users = new Map<string, TokenUserInfo>([
  [A, { pseudo: "Max", popupMentionsOptOut: false }],
  [B, { pseudo: "Zoé", popupMentionsOptOut: true }],
]);

const content: WeeklyPopupContent = {
  titre: "Max en tête",
  champion: `{{u:${A}}} finit premier.`,
  top: `{{u:${B}}} a vu juste, devant {{u:${A}}}.`,
  flop: null,
  refuse: "  ",
  cta: "À tes pronos.",
};

describe("toDisplayedPopup", () => {
  it("résout les jetons et écarte les blocs vides", () => {
    const d = toDisplayedPopup(content, users);
    expect(d.sections.map((s) => s.key)).toEqual(["champion", "top"]);
    expect(d.sections[0].text).toBe("@Max finit premier.");
    expect(d.sections[1].text).toBe("un joueur discret a vu juste, devant @Max.");
    expect(d.repli).toBeNull();
  });

  it("un compte supprimé ou inconnu devient « un ancien joueur »", () => {
    const d = toDisplayedPopup({ ...content, champion: `{{u:supprime}} puis {{u:${C}}}` }, users);
    expect(d.sections[0].text).toBe("un ancien joueur puis un ancien joueur");
  });

  it("garde le texte de repli", () => {
    const d = toDisplayedPopup(
      { titre: "T", champion: null, top: null, flop: null, refuse: null, cta: "C", repli: "Rien à dire." },
      users,
    );
    expect(d.sections).toEqual([]);
    expect(d.repli).toBe("Rien à dire.");
  });
});

describe("userIdsInContent", () => {
  it("liste les joueurs cités, sans doublon", () => {
    expect(userIdsInContent(content).sort()).toEqual([A, B]);
  });
});

describe("mentionsForExport", () => {
  it("ne rend que les blocs qui citent le joueur", () => {
    expect(mentionsForExport(content, A, users).map((m) => m.bloc)).toEqual(["champion", "top"]);
    expect(mentionsForExport(content, B, users).map((m) => m.bloc)).toEqual(["top"]);
  });

  it("ne renvoie rien pour un joueur non cité", () => {
    expect(mentionsForExport(content, C, users)).toEqual([]);
  });

  it("n'expose aucun jeton brut", () => {
    for (const m of mentionsForExport(content, A, users)) expect(m.texte).not.toContain("{{u:");
  });
});
