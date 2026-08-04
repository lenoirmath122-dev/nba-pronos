import { getServerClient } from "@/lib/supabase/server";
import { resolveLeagueScope } from "@/lib/queries/leagues";
import { assignRanks, type RankableScore } from "@/lib/scoring/ranking";
import { BET_DIFFICULTY_LABELS, type BetDifficulty } from "@/lib/labels/bets";

// Lecture du nouvel onglet Stats (Profil, 04/08/2026) — composant serveur
// uniquement. Portée V1 alignée sur tous les écrans comparables (Classement,
// Bracket, player-profile.ts) : compétition ACTIVE uniquement, pas
// d'agrégation multi-compétitions archivées.
//
// Le filtre Général/Ligue (resolveLeagueScope, même mécanisme que Classement/
// Bracket) ne porte QUE sur rank/comparison — accuracy/pointsBreakdown/
// evolution/betRecord restent des stats personnelles, un filtre de groupe
// n'a pas de sens dessus (décision actée avec l'utilisateur, cf. le plan).

export type ProfileStatsAccuracy = {
  totalScoredPredictions: number;
  correctWinners: number;
  exactMargins: number;
  winnerAccuracyPct: number | null;
  marginAccuracyPct: number | null;
};

export type ProfileStatsPointsBreakdown = {
  totalPoints: number;
  matchesPoints: number;
  bracketPoints: number;
  betsPoints: number;
};

export type ProfileStatsRank = { value: number | null; totalPlayers: number };

export type ProfileStatsComparison = {
  ownTotalPoints: number;
  othersAveragePoints: number;
  deltaVsAverage: number;
  scopeLeagueId: string | null;
  scopeLeagueName: string | null;
};

export type ProfileStatsEvolutionPoint = { date: string; rank: number; totalPoints: number };

export type ProfileStatsBestWin = { description: string; difficultyLabel: string; points: number };

export type ProfileStatsBetRecord = {
  resolvedCount: number;
  wonCount: number;
  lostCount: number;
  winRatePct: number | null;
  bestWin: ProfileStatsBestWin | null;
};

export type ProfileStatsData =
  | { hasActiveCompetition: false }
  | {
      hasActiveCompetition: true;
      competitionId: string;
      competitionName: string;
      hasScored: boolean;
      accuracy: ProfileStatsAccuracy;
      pointsBreakdown: ProfileStatsPointsBreakdown;
      rank: ProfileStatsRank;
      comparison: ProfileStatsComparison;
      evolution: { series: ProfileStatsEvolutionPoint[] };
      betRecord: ProfileStatsBetRecord;
    };

type CompetitionRow = { id: string; name: string };

type UserScoreRow = RankableScore & {
  matches_points: number;
  bracket_points: number;
  bets_points: number;
};

type BetRow = {
  description: string;
  validated_difficulty: BetDifficulty | null;
  proposed_difficulty: BetDifficulty;
  status: "WON" | "LOST";
  points_awarded: number | null;
  scored_at: string | null;
};

export async function getProfileStats(leagueId?: string | null): Promise<ProfileStatsData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasActiveCompetition: false };

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return { hasActiveCompetition: false };

  const [{ data: scoresData }, { count: totalScoredPredictions }, { data: snapshotsData }, { data: betsData }, scope] =
    await Promise.all([
      supabase
        .from("user_scores")
        .select("user_id, total_points, matches_points, bracket_points, bets_points, correct_match_winners, exact_margins")
        .eq("competition_id", competition.id),
      supabase
        .from("match_predictions")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", competition.id)
        .eq("user_id", user.id)
        .not("scored_at", "is", null),
      supabase
        .from("leaderboard_snapshots")
        .select("rank, total_points, snapshot_date")
        .eq("competition_id", competition.id)
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("bets")
        .select("description, validated_difficulty, proposed_difficulty, status, points_awarded, scored_at")
        .eq("competition_id", competition.id)
        .eq("user_id", user.id)
        .in("status", ["WON", "LOST"]),
      resolveLeagueScope(supabase, leagueId),
    ]);

  const allScoreRows = (scoresData ?? []) as UserScoreRow[];
  const scopeUserIds = scope?.memberUserIds ?? null;
  const scoreRows = scopeUserIds ? allScoreRows.filter((row) => scopeUserIds.has(row.user_id)) : allScoreRows;

  const ownRow = scoreRows.find((row) => row.user_id === user.id);
  const hasScored = ownRow !== undefined;
  const ranks = assignRanks(scoreRows);

  const othersRows = scoreRows.filter((row) => row.user_id !== user.id);
  const averageBase = hasScored ? othersRows : scoreRows;
  const othersAveragePoints =
    averageBase.length > 0 ? averageBase.reduce((sum, row) => sum + row.total_points, 0) / averageBase.length : 0;
  const ownTotalPoints = ownRow?.total_points ?? 0;

  const correctWinners = ownRow?.correct_match_winners ?? 0;
  const exactMargins = ownRow?.exact_margins ?? 0;
  const scoredCount = totalScoredPredictions ?? 0;

  const series: ProfileStatsEvolutionPoint[] = (snapshotsData ?? []).map((row) => ({
    date: row.snapshot_date as string,
    rank: row.rank as number,
    totalPoints: row.total_points as number,
  }));

  return {
    hasActiveCompetition: true,
    competitionId: competition.id,
    competitionName: competition.name,
    hasScored,
    accuracy: {
      totalScoredPredictions: scoredCount,
      correctWinners,
      exactMargins,
      winnerAccuracyPct: scoredCount > 0 ? Math.round((correctWinners / scoredCount) * 100) : null,
      marginAccuracyPct: scoredCount > 0 ? Math.round((exactMargins / scoredCount) * 100) : null,
    },
    pointsBreakdown: {
      totalPoints: ownRow?.total_points ?? 0,
      matchesPoints: ownRow?.matches_points ?? 0,
      bracketPoints: ownRow?.bracket_points ?? 0,
      betsPoints: ownRow?.bets_points ?? 0,
    },
    rank: {
      value: hasScored ? (ranks.get(user.id) ?? null) : null,
      totalPlayers: scoreRows.length,
    },
    comparison: {
      ownTotalPoints,
      othersAveragePoints: Math.round(othersAveragePoints),
      deltaVsAverage: Math.round(ownTotalPoints - othersAveragePoints),
      scopeLeagueId: scope?.id ?? null,
      scopeLeagueName: scope?.name ?? null,
    },
    evolution: { series },
    betRecord: computeBetRecord((betsData ?? []) as BetRow[]),
  };
}

function computeBetRecord(bets: BetRow[]): ProfileStatsBetRecord {
  const wonBets = bets.filter((bet) => bet.status === "WON");
  const lostCount = bets.filter((bet) => bet.status === "LOST").length;
  const resolvedCount = wonBets.length + lostCount;

  // "Plus gros coup" : difficulté max parmi les WON ; ex-aequo -> le plus
  // RÉCENT (scored_at desc), déterministe et simple (décision actée du plan).
  const bestWinRow = [...wonBets].sort((a, b) => {
    const diffA = a.validated_difficulty ?? a.proposed_difficulty;
    const diffB = b.validated_difficulty ?? b.proposed_difficulty;
    if (diffB !== diffA) return diffB - diffA;
    return (b.scored_at ?? "").localeCompare(a.scored_at ?? "");
  })[0];

  return {
    resolvedCount,
    wonCount: wonBets.length,
    lostCount,
    winRatePct: resolvedCount > 0 ? Math.round((wonBets.length / resolvedCount) * 100) : null,
    bestWin: bestWinRow
      ? {
          description: bestWinRow.description,
          difficultyLabel: BET_DIFFICULTY_LABELS[bestWinRow.validated_difficulty ?? bestWinRow.proposed_difficulty],
          points: bestWinRow.points_awarded ?? 0,
        }
      : null,
  };
}
