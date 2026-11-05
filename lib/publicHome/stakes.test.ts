import { describe, it, expect } from "vitest";
import { MARGIN_BONUS_DISPLAY_TIERS, MATCH_WINNER_POINTS } from "@/lib/scoring/engine";
import { stakesLine } from "./stakes";

describe("stakesLine", () => {
  it("reprend les points du moteur de scoring", () => {
    const line = stakesLine();
    expect(line).toContain(`bon vainqueur ${MATCH_WINNER_POINTS} pts`);
    expect(line).toContain(`écart exact +${MARGIN_BONUS_DISPLAY_TIERS[0].points}`);
    expect(line).toContain(`écart à 1-2 pts +${MARGIN_BONUS_DISPLAY_TIERS[1].points}`);
  });
});
