import { describe, expect, it } from "vitest";
import { applyReactionTap, emptyReactionSummary, reactionKey, summarizeReactions } from "./reactions";

describe("réactions aux highlights de nuit", () => {
  it("regroupe par highlight, repère la réaction du joueur et ignore l'inconnu", () => {
    const summaries = summarizeReactions(
      [
        { recap_date: "2026-11-13", target: "BEST_BET", user_id: "me", kind: "RESPECT" },
        { recap_date: "2026-11-13", target: "BEST_BET", user_id: "x", kind: "CHAMBRER" },
        { recap_date: "2026-11-13", target: "BEST_BET", user_id: "y", kind: "RESPECT" },
        { recap_date: "2026-11-13", target: "AUTRE", user_id: "z", kind: "RESPECT" },
      ],
      "me"
    );
    expect(summaries.get(reactionKey("2026-11-13", "BEST_BET"))).toEqual({ counts: { RESPECT: 2, CHAMBRER: 1 }, mine: "RESPECT" });
    expect(summaries.size).toBe(1);
  });

  it("un tap pose, remplace ou retire la réaction", () => {
    const posed = applyReactionTap(emptyReactionSummary(), "RESPECT");
    expect(posed).toEqual({ counts: { RESPECT: 1, CHAMBRER: 0 }, mine: "RESPECT" });
    const replaced = applyReactionTap(posed, "CHAMBRER");
    expect(replaced).toEqual({ counts: { RESPECT: 0, CHAMBRER: 1 }, mine: "CHAMBRER" });
    expect(applyReactionTap(replaced, "CHAMBRER")).toEqual({ counts: { RESPECT: 0, CHAMBRER: 0 }, mine: null });
  });
});
