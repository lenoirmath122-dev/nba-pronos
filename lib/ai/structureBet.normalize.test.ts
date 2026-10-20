import { describe, expect, it } from "vitest";
import { normalizeBetStructuration } from "./structureBet";

type Raw = Parameters<typeof normalizeBetStructuration>[0];

const base = {
  calculable: true,
  bet_subject: null,
  player: null,
  team_stat: null,
  match_total: null,
  comparison_bet: null,
  combo_bet: null,
  reasoning: "",
} as unknown as Raw;

const player = (stat: string, threshold: number | null, comparison: string | null) =>
  ({ name: "X", team: "team1", stat, threshold, comparison, not_in_match: false }) as unknown;

describe("normalizeBetStructuration", () => {
  it("joueur « au moins 25 points » : OVER strict 24", () => {
    const out = normalizeBetStructuration({ ...base, player: player("pts", 25, "AT_LEAST") } as unknown as Raw);
    expect(out.player).toMatchObject({ threshold: 24, comparison: "OVER" });
  });

  it("joueur « au plus 3 » : UNDER strict 4", () => {
    const out = normalizeBetStructuration({ ...base, player: player("stl", 3, "AT_MOST") } as unknown as Raw);
    expect(out.player).toMatchObject({ threshold: 4, comparison: "UNDER" });
  });

  it("joueur « plus de 25 points » : inchangé", () => {
    const out = normalizeBetStructuration({ ...base, player: player("pts", 25, "OVER") } as unknown as Raw);
    expect(out.player).toMatchObject({ threshold: 25, comparison: "OVER" });
  });

  it("équipe « 45+ rebonds » et total « au plus 200 »", () => {
    const out = normalizeBetStructuration({
      ...base,
      team_stat: { team: "team1", stat: "reb", threshold: 45, comparison: "AT_LEAST" },
      match_total: { stat: "total_points", threshold: 200, comparison: "AT_MOST", negation: false },
    } as unknown as Raw);
    expect(out.team_stat).toMatchObject({ threshold: 44, comparison: "OVER" });
    expect(out.match_total).toMatchObject({ threshold: 201, comparison: "UNDER" });
  });

  it("combo : fourchette 101-110 inclus", () => {
    const out = normalizeBetStructuration({
      ...base,
      combo_bet: {
        conditions: [
          { kind: "team1", players: [], stats: ["pts"], threshold: 101, comparison: "AT_LEAST" },
          { kind: "team1", players: [], stats: ["pts"], threshold: 110, comparison: "AT_MOST" },
        ],
      },
    } as unknown as Raw);
    expect(out.combo_bet?.conditions.map((c) => [c.threshold, c.comparison])).toEqual([
      [100, "OVER"],
      [111, "UNDER"],
    ]);
  });

  it("dd/td inchangé, pourcentage décalé d'un epsilon", () => {
    const out = normalizeBetStructuration({
      ...base,
      player: player("td", null, null),
      team_stat: { team: "team1", stat: "fg", threshold: 0.5, comparison: "AT_LEAST" },
    } as unknown as Raw);
    expect(out.player).toMatchObject({ threshold: null, comparison: null });
    expect(out.team_stat?.threshold).toBeLessThan(0.5);
    expect(out.team_stat?.threshold).toBeGreaterThan(0.499);
  });
});
