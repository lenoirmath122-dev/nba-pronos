import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllTeams } from "@/lib/queries/teams";
import type { RankableScore } from "@/lib/scoring/ranking";
import { articleForMatch, type FeedArticle } from "./trashtalk";
import {
  buildCompetitionRecap,
  type CompetitionRecap,
  type NightMatch,
  type ScoredBetRow,
  type ScoredPredictionRow,
  type SnapshotRow,
} from "./build";
import type { RecapPeriod } from "./period";

// Lecture des données d'un récap (p3-10). Appelé avec la session du joueur
// par l'Accueil (la RLS laisse déjà voir les pronos et paris des autres une
// fois verrouillés, et le classement à tous) et avec service_role par le job
// d'envoi, qui calcule la partie commune une seule fois pour tous.

type MatchRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

async function loadBaseline(supabase: SupabaseClient, competitionId: string, before: string): Promise<SnapshotRow[]> {
  const { data: latest } = await supabase
    .from("leaderboard_snapshots")
    .select("snapshot_date")
    .eq("competition_id", competitionId)
    .lt("snapshot_date", before)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ snapshot_date: string }>();
  // Aucun snapshot avant la fenêtre : la compétition vient de démarrer,
  // personne n'avait de point.
  if (!latest) return [];

  const { data } = await supabase
    .from("leaderboard_snapshots")
    .select("user_id, rank, total_points")
    .eq("competition_id", competitionId)
    .eq("snapshot_date", latest.snapshot_date);
  return (data ?? []) as SnapshotRow[];
}

export async function loadCompetitionRecap(
  supabase: SupabaseClient,
  competitionId: string,
  period: RecapPeriod,
  /** Flux TrashTalk, lu seulement s'il y a des matchs dans la fenêtre. */
  getArticles: () => Promise<FeedArticle[]>
): Promise<CompetitionRecap> {
  const [{ data: scoresData }, baseline, { data: matchesData }, { data: betsData }] = await Promise.all([
    supabase
      .from("user_scores")
      .select("user_id, total_points, correct_match_winners, exact_margins, bracket_points")
      .eq("competition_id", competitionId),
    loadBaseline(supabase, competitionId, period.baselineBefore),
    supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score, scheduled_at")
      .eq("competition_id", competitionId)
      .eq("status", "FINISHED")
      .gte("scheduled_at", period.startIso)
      .lt("scheduled_at", period.endIso)
      .order("scheduled_at", { ascending: true }),
    // Paris tranchés pendant la fenêtre : pour eux scored_at est fiable
    // (seul recomputeBet l'écrit, au moment de la résolution).
    supabase
      .from("bets")
      .select("user_id, description, status, validated_difficulty, calculated_proba, points_awarded")
      .eq("competition_id", competitionId)
      .in("status", ["WON", "LOST"])
      .gte("scored_at", period.startIso)
      .lt("scored_at", period.endIso),
  ]);

  const scores = (scoresData ?? []) as RankableScore[];
  const matches = (matchesData ?? []) as MatchRow[];
  const bets = (betsData ?? []) as ScoredBetRow[];

  const userIds = [...new Set([...scores.map((row) => row.user_id), ...bets.map((bet) => bet.user_id)])];
  const matchIds = matches.map((match) => match.id);

  const [{ data: usersData }, { data: predictionsData }, teams, articles] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id, pseudo").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; pseudo: string }[] }),
    matchIds.length > 0
      ? supabase
          .from("match_predictions")
          .select("user_id, is_winner_correct, margin_diff")
          .in("match_id", matchIds)
          .neq("status", "DRAFT")
          .not("scored_at", "is", null)
      : Promise.resolve({ data: [] as ScoredPredictionRow[] }),
    matches.length > 0 ? getAllTeams() : Promise.resolve([]),
    matches.length > 0 ? getArticles() : Promise.resolve([] as FeedArticle[]),
  ]);

  const teamById = new Map(teams.map((team) => [team.id, team]));
  const nightMatches: NightMatch[] = matches.map((match) => {
    const home = match.home_team_id ? teamById.get(match.home_team_id) : undefined;
    const away = match.away_team_id ? teamById.get(match.away_team_id) : undefined;
    const article = home && away ? articleForMatch(articles, home.name, away.name, period.startIso) : null;
    return {
      id: match.id,
      label: `${home?.abbreviation ?? "?"} ${match.home_score ?? "-"} - ${match.away_score ?? "-"} ${away?.abbreviation ?? "?"}`,
      articleUrl: article?.url ?? null,
    };
  });

  return buildCompetitionRecap({
    period,
    scores,
    baseline,
    pseudoById: new Map(((usersData ?? []) as { id: string; pseudo: string }[]).map((row) => [row.id, row.pseudo])),
    predictions: (predictionsData ?? []) as ScoredPredictionRow[],
    bets,
    nightMatches,
  });
}

export type UpcomingMatches = {
  /** Matchs pronostiquables dans les prochaines 24h, du plus proche au plus lointain. */
  matches: { id: string; scheduledAt: string }[];
  /** Matchs déjà pronostiqués (hors brouillon), par joueur. */
  predictedByUser: Map<string, Set<string>>;
};

/** Ce qui reste à pronostiquer aujourd'hui (bloc « Aujourd'hui » du push
 *  journalier) : matchs programmés dans les 24h dont les deux équipes sont
 *  connues. */
export async function loadUpcomingMatches(
  supabase: SupabaseClient,
  competitionId: string,
  nowMs: number
): Promise<UpcomingMatches> {
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, scheduled_at")
    .eq("competition_id", competitionId)
    .eq("status", "SCHEDULED")
    .not("home_team_id", "is", null)
    .not("away_team_id", "is", null)
    .gt("scheduled_at", new Date(nowMs).toISOString())
    .lte("scheduled_at", new Date(nowMs + 24 * 60 * 60 * 1000).toISOString())
    .order("scheduled_at", { ascending: true });

  const matches = (matchesData ?? []) as { id: string; scheduled_at: string }[];
  const matchIds = matches.map((match) => match.id);
  const predictedByUser = new Map<string, Set<string>>();
  if (matchIds.length > 0) {
    const { data: predictions } = await supabase
      .from("match_predictions")
      .select("user_id, match_id")
      .in("match_id", matchIds)
      .neq("status", "DRAFT");
    for (const row of (predictions ?? []) as { user_id: string; match_id: string }[]) {
      const set = predictedByUser.get(row.user_id) ?? new Set<string>();
      set.add(row.match_id);
      predictedByUser.set(row.user_id, set);
    }
  }

  return {
    matches: matches.map((match) => ({ id: match.id, scheduledAt: match.scheduled_at })),
    predictedByUser,
  };
}
