import { formLabel, isEarlySeason, isUsualStarter, playerTrend, selectKeyPlayers } from "./labels";
import type { PlayerSeasonLine, TeamFormSummary, TeamInsights } from "./types";

// Assemblage pur des lignes stats_team_form / stats_player_season vers les
// types de l'appli (aucun accès base : testable sans réseau).

type Numeric = number | string | null;

export type TeamFormRow = {
  team_id: number;
  tricode: string;
  conference: "EAST" | "WEST" | null;
  games_played: number;
  wins: number;
  losses: number;
  home_wins: number;
  home_losses: number;
  away_wins: number;
  away_losses: number;
  pts_for_avg: Numeric;
  pts_against_avg: Numeric;
  point_diff_avg: Numeric;
  last5_results: string;
  last5_wins: number;
  last5_point_diff_avg: Numeric;
  streak_type: string;
  streak_length: number;
  conference_rank: number | null;
  computed_at?: string;
};

export type PlayerSeasonRow = {
  player_id: number;
  first_name: string;
  family_name: string;
  current_team_id: number;
  games_played: number;
  games_with_current_team: number;
  games_started: number;
  minutes_avg: Numeric;
  pts_avg: Numeric;
  reb_avg: Numeric;
  ast_avg: Numeric;
  stl_avg: Numeric;
  blk_avg: Numeric;
  fg3m_avg: Numeric;
  fg_pct: Numeric;
  fg3_pct: Numeric;
  ft_pct: Numeric;
  ts_pct: Numeric;
  last5_games: number;
  last5_pts_avg: Numeric;
  computed_at?: string;
};

function num(v: Numeric | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function toTeamFormSummary(row: TeamFormRow): TeamFormSummary {
  return {
    record: { wins: row.wins, losses: row.losses },
    last5: [...row.last5_results].filter((c): c is "V" | "D" => c === "V" || c === "D"),
    streak: { type: row.streak_type === "D" ? "D" : "V", length: row.streak_length },
    pointDiffLast5: num(row.last5_point_diff_avg) ?? 0,
    label: formLabel(row.games_played, row.last5_wins),
    conferenceRank: row.conference_rank,
    conference: row.conference,
  };
}

export function toPlayerLine(row: PlayerSeasonRow): PlayerSeasonLine {
  const pts = num(row.pts_avg) ?? 0;
  return {
    playerId: row.player_id,
    name: `${row.first_name} ${row.family_name}`.trim(),
    gamesPlayed: row.games_played,
    gamesWithTeam: row.games_with_current_team,
    isUsualStarter: isUsualStarter(row.games_started, row.games_played),
    minutes: num(row.minutes_avg) ?? 0,
    pts,
    reb: num(row.reb_avg) ?? 0,
    ast: num(row.ast_avg) ?? 0,
    stl: num(row.stl_avg) ?? 0,
    blk: num(row.blk_avg) ?? 0,
    fg3m: num(row.fg3m_avg) ?? 0,
    fgPct: num(row.fg_pct),
    fg3Pct: num(row.fg3_pct),
    ftPct: num(row.ft_pct),
    tsPct: num(row.ts_pct),
    trend: playerTrend({
      gamesPlayed: row.games_played,
      last5Games: row.last5_games,
      ptsAvg: pts,
      last5PtsAvg: num(row.last5_pts_avg) ?? pts,
    }),
    joinedMidSeason: row.games_with_current_team < row.games_played,
  };
}

/** Une équipe de l'appli (uuid + tricode) → ses détails. Sans ligne : form null, roster vide. */
export function buildTeamInsights(
  team: { id: string; abbreviation: string },
  formRow: TeamFormRow | undefined,
  playerRows: PlayerSeasonRow[]
): TeamInsights {
  if (!formRow) {
    return {
      teamId: team.id,
      tricode: team.abbreviation,
      form: null,
      home: null,
      away: null,
      ptsForAvg: null,
      ptsAgainstAvg: null,
      pointDiffAvg: null,
      earlySeason: true,
      keyPlayers: [],
      roster: [],
    };
  }
  const roster = playerRows
    .filter((p) => p.current_team_id === formRow.team_id)
    .map(toPlayerLine)
    .sort((a, b) => b.minutes - a.minutes);
  return {
    teamId: team.id,
    tricode: team.abbreviation,
    form: toTeamFormSummary(formRow),
    home: { wins: formRow.home_wins, losses: formRow.home_losses },
    away: { wins: formRow.away_wins, losses: formRow.away_losses },
    ptsForAvg: num(formRow.pts_for_avg),
    ptsAgainstAvg: num(formRow.pts_against_avg),
    pointDiffAvg: num(formRow.point_diff_avg),
    earlySeason: isEarlySeason(formRow.games_played),
    keyPlayers: selectKeyPlayers(roster, formRow.games_played),
    roster,
  };
}
