import { describe, expect, it } from "vitest";
import { normalizeBetStructuration, type BetStructuration } from "./structureBet";

const base = {
  calculable: true,
  bet_subject: null,
  player: null,
  team_stat: null,
  match_total: null,
  comparison_bet: null,
  combo_bet: null,
  reasoning: "",
} as unknown as BetStructuration;

describe("normalizeBetStructuration", () => {
  it("joueur « au moins 25 points » : seuil strict 24", () => {
    const out = normalizeBetStructuration({
      ...base,
      player: { name: "X", team: "team1", stat: "pts", threshold: 25, comparison: "OVER", inclusive: true, not_in_match: false },
    } as unknown as BetStructuration);
    expect(out.player?.threshold).toBe(24);
  });

  it("joueur « plus de 25 points » : inchangé", () => {
    const out = normalizeBetStructuration({
      ...base,
      player: { name: "X", team: "team1", stat: "pts", threshold: 25, comparison: "OVER", inclusive: false, not_in_match: false },
    } as unknown as BetStructuration);
    expect(out.player?.threshold).toBe(25);
  });

  it("équipe « 45+ rebonds » et total « au plus 200 » ", () => {
    const out = normalizeBetStructuration({
      ...base,
      team_stat: { team: "team1", stat: "reb", threshold: 45, comparison: "OVER", inclusive: true },
      match_total: { stat: "total_points", threshold: 200, comparison: "UNDER", inclusive: true, negation: false },
    } as unknown as BetStructuration);
    expect(out.team_stat?.threshold).toBe(44);
    expect(out.match_total?.threshold).toBe(201);
  });

  it("combo : fourchette 101-110 inclus", () => {
    const out = normalizeBetStructuration({
      ...base,
      combo_bet: {
        conditions: [
          { kind: "team1", players: [], stats: ["pts"], threshold: 101, comparison: "OVER", inclusive: true },
          { kind: "team1", players: [], stats: ["pts"], threshold: 110, comparison: "UNDER", inclusive: true },
        ],
      },
    } as unknown as BetStructuration);
    expect(out.combo_bet?.conditions.map((c) => c.threshold)).toEqual([100, 111]);
  });

  it("dd/td (threshold null) et pourcentage : inchangés", () => {
    const out = normalizeBetStructuration({
      ...base,
      player: { name: "X", team: "team1", stat: "td", threshold: null, comparison: null, inclusive: true, not_in_match: false },
      team_stat: { team: "team1", stat: "fg", threshold: 0.5, comparison: "OVER", inclusive: true },
    } as unknown as BetStructuration);
    expect(out.player?.threshold).toBeNull();
    expect(out.team_stat?.threshold).toBe(0.5);
  });
});
