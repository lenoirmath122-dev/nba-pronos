import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/lib/queries/home";
import { chatReplyHref, CHAT_PREFILL_MAX_LENGTH, nightLabel, nightTally, replyToBestBet, replyToTopScorers, tallyLabel } from "./night";

const item = (outcome: FeedItem["outcome"]): FeedItem => ({
  kind: outcome === "neutral" ? "bet_resolved" : "bet_scored",
  label: "pari",
  detail: null,
  points: outcome === "win" ? 10 : 0,
  outcome,
  occurredAt: "2026-11-13T05:00:00.000Z",
  href: null,
});

describe("carte « Ta nuit »", () => {
  it("libellé de la nuit, y compris à cheval sur deux mois", () => {
    expect(nightLabel("2026-11-13")).toBe("Nuit du 12 au 13 nov.");
    expect(nightLabel("2026-11-01")).toBe("Nuit du 31 oct. au 1 nov.");
  });

  it("bilan : un pari neutralisé ne compte ni comme réussi ni dans le total", () => {
    const tally = nightTally([item("win"), item("loss"), item("loss"), item("neutral")]);
    expect(tally).toEqual({ won: 1, settled: 3 });
    expect(tallyLabel(tally)).toBe("1 réussi sur 3");
    expect(tallyLabel({ won: 2, settled: 4 })).toBe("2 réussis sur 4");
  });

  it("Répondre : mentionne les joueurs et borne le texte pré-rempli", () => {
    expect(replyToTopScorers([
      { userId: "a", pseudo: "Anaïssss", value: 13 },
      { userId: "f", pseudo: "Fin_connaisseur", value: 13 },
    ])).toBe("@Anaïssss @Fin_connaisseur meilleure nuit (+13 pts) ");
    expect(
      replyToBestBet({ userId: "a", pseudo: "Anaïssss", description: "Ayo Dosunmu marque plus de 15 points", difficulty: 1, proba: 0.72 })
    ).toBe("@Anaïssss « Ayo Dosunmu marque plus de 15 points » ");
    const href = chatReplyHref("x".repeat(500));
    expect(href.startsWith("/chat?canal=general&citer=")).toBe(true);
    expect(decodeURIComponent(href.split("citer=")[1])).toHaveLength(CHAT_PREFILL_MAX_LENGTH);
  });
});
