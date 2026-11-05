import { describe, expect, it } from "vitest";
import { buildTeamInsights, toTeamFormSummary, type PlayerSeasonRow, type TeamFormRow } from "./build";

const formRow: TeamFormRow = {
  team_id: 10,
  tricode: "LAL",
  conference: "WEST",
  games_played: 9,
  wins: 7,
  losses: 2,
  home_wins: 4,
  home_losses: 1,
  away_wins: 3,
  away_losses: 1,
  pts_for_avg: "115.2",
  pts_against_avg: "108.0",
  point_diff_avg: "7.2",
  last5_results: "VVDVV",
  last5_wins: 4,
  last5_point_diff_avg: "6.4",
  streak_type: "V",
  streak_length: 2,
  conference_rank: 3,
};

function player(over: Partial<PlayerSeasonRow>): PlayerSeasonRow {
  return {
    player_id: 1,
    first_name: "Luka",
    family_name: "Doncic",
    current_team_id: 10,
    games_played: 9,
    games_with_current_team: 9,
    games_started: 9,
    minutes_avg: "35.5",
    pts_avg: "30.1",
    reb_avg: "8.0",
    ast_avg: "8.5",
    stl_avg: "1.0",
    blk_avg: "0.5",
    fg3m_avg: "3.2",
    fg_pct: "0.480",
    fg3_pct: null,
    ft_pct: "0.800",
    ts_pct: "0.600",
    last5_games: 5,
    last5_pts_avg: "31.0",
    ...over,
  };
}

describe("toTeamFormSummary", () => {
  it("convertit les numeric texte et les 5 derniers résultats", () => {
    const f = toTeamFormSummary(formRow);
    expect(f.last5).toEqual(["V", "V", "D", "V", "V"]);
    expect(f.pointDiffLast5).toBe(6.4);
    expect(f.label).toBe("EN_FEU");
    expect(f.streak).toEqual({ type: "V", length: 2 });
    expect(f.conferenceRank).toBe(3);
  });
});

describe("buildTeamInsights", () => {
  const team = { id: "uuid-lal", abbreviation: "LAL" };

  it("équipe sans ligne : form null, roster vide", () => {
    const r = buildTeamInsights(team, undefined, [player({})]);
    expect(r.form).toBeNull();
    expect(r.roster).toEqual([]);
    expect(r.keyPlayers).toEqual([]);
  });

  it("tricode inconnu : aucune erreur", () => {
    expect(() => buildTeamInsights({ id: "x", abbreviation: "" }, undefined, [])).not.toThrow();
  });

  it("joueur transféré : rangé dans sa nouvelle équipe, joinedMidSeason", () => {
    const traded = player({ player_id: 2, first_name: "A", family_name: "B", games_played: 9, games_with_current_team: 3 });
    const elsewhere = player({ player_id: 3, current_team_id: 99 });
    const r = buildTeamInsights(team, formRow, [traded, elsewhere]);
    expect(r.roster.map((p) => p.playerId)).toEqual([2]);
    expect(r.roster[0].joinedMidSeason).toBe(true);
    expect(r.roster[0].gamesPlayed).toBe(9);
    // 3 matchs avec l'équipe < ceil(0,5 × 9) = 5 : listé mais pas joueur clé
    expect(r.keyPlayers).toEqual([]);
  });

  it("roster trié par minutes, 3 joueurs clés max, earlySeason", () => {
    const rows = [
      player({ player_id: 1, minutes_avg: "20.0", pts_avg: "25.0" }),
      player({ player_id: 2, minutes_avg: "36.0", pts_avg: "10.0" }),
      player({ player_id: 3, minutes_avg: "30.0", pts_avg: "15.0" }),
      player({ player_id: 4, minutes_avg: "28.0", pts_avg: "12.0" }),
    ];
    const r = buildTeamInsights(team, formRow, rows);
    expect(r.roster.map((p) => p.playerId)).toEqual([2, 3, 4, 1]);
    expect(r.keyPlayers.map((p) => p.playerId)).toEqual([1, 3, 4]);
    expect(r.earlySeason).toBe(true);
    expect(r.ptsForAvg).toBe(115.2);
  });
});
