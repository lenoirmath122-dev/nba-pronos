import { describe, expect, it } from "vitest";
import { activeMentionQuery, matchesEveryone, splitMentions } from "./mentions";

const targets = [
  { id: "1", pseudo: "Léo" },
  { id: "2", pseudo: "Jean Paul" },
  { id: "3", pseudo: "Jean" },
];

describe("splitMentions", () => {
  it("reconnaît un pseudo, le plus long d'abord, sans tenir compte de la casse", () => {
    expect(splitMentions("Salut @jean paul et @Léo!", targets)).toEqual([
      { type: "text", text: "Salut " },
      { type: "mention", text: "@jean paul", userId: "2" },
      { type: "text", text: " et " },
      { type: "mention", text: "@Léo", userId: "1" },
      { type: "text", text: "!" },
    ]);
  });

  it("ignore un pseudo inconnu, un préfixe de mot ou un @ collé à un mot", () => {
    expect(splitMentions("@Jeannot a@Léo @Léox", targets)).toEqual([{ type: "text", text: "@Jeannot a@Léo @Léox" }]);
  });
});

describe("@tout le monde", () => {
  it("reconnaît la mention collective, sans tenir compte de la casse", () => {
    expect(splitMentions("@Tout le monde ce soir !", targets)).toEqual([
      { type: "everyone", text: "@Tout le monde" },
      { type: "text", text: " ce soir !" },
    ]);
    expect(splitMentions("@tout le mondeX", targets)).toEqual([{ type: "text", text: "@tout le mondeX" }]);
  });

  it("propose la mention collective sur un début de saisie", () => {
    expect(matchesEveryone("")).toBe(true);
    expect(matchesEveryone("Tou")).toBe(true);
    expect(matchesEveryone("tout le")).toBe(true);
    expect(matchesEveryone("Léo")).toBe(false);
  });
});

describe("activeMentionQuery", () => {
  it("détecte la saisie après un @", () => {
    expect(activeMentionQuery("hey @Jé", 7)).toEqual({ start: 4, query: "Jé" });
    expect(activeMentionQuery("mail a@b", 8)).toBeNull();
    expect(activeMentionQuery("rien", 4)).toBeNull();
  });
});
