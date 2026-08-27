import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS, type BetCategory, type BetDifficulty } from "@/lib/labels/bets";
import { assignRanks, type RankableScore } from "@/lib/scoring/ranking";
import { toAdminCorrection, type AdminCorrection } from "@/lib/queries/adminCorrection";
import { getProfileBadges, type BadgeDisplay } from "@/lib/queries/badges";
import type { TeamRef } from "@/lib/queries/matches";

// Lecture de la page "profil joueur" (`/players/[userId]`, BACKLOG discuté
// le 30/07/2026 — "voir le bracket/pronos/paris de chacun, quelque part").
// Composant serveur, RLS seule autorité de visibilité : match_predictions
// (« valider = voir », T3), brackets/bracket_picks (après
// bracket_deadline_passed), bets (bet_is_public — statut public ET
// deadline passée). Cette page ne fait qu'AGRÉGER ce qui est déjà visible
// ailleurs (Bracket, Matchs, Mes pronos), rien de nouveau n'est exposé.
//
// Contenu volontairement filtré ICI (pas seulement par la RLS) pour rester
// COHÉRENT quel que soit le visiteur : un admin ou le joueur lui-même
// verraient techniquement plus via la RLS (leurs propres brouillons, un
// pari non public) — cette page reste la même vue "publique" pour tout le
// monde, même le propriétaire du profil qui cliquerait sur son propre
// pseudo.
//
// Périmètre V1 : compétition ACTIVE uniquement (même limite que Classement/
// Bracket) — pas d'historique multi-compétitions ici, voir GAPS_OUVERTS.md.

const BET_CATEGORY_LABELS: Record<BetCategory, string> = Object.fromEntries(
  BET_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<BetCategory, string>;

export type PlayerProfileMatchPrediction = {
  matchId: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  scheduledAt: string;
  predictedWinner: TeamRef;
  predictedMargin: number;
  points: number | null; // null = pas encore scoré (match pas FINISHED)
  adminCorrection: AdminCorrection | null;
};

export type PlayerProfileBracketPick = {
  seriesId: string;
  round: string;
  roundLabel: string;
  teamA: TeamRef | null;
  teamB: TeamRef | null;
  predictedWinner: TeamRef | null; // null = case pas remplie
  predictedScoreFormat: string | null;
  actualWinnerAbbreviation: string | null;
  points: number | null;
};

export type PlayerProfileBet = {
  betId: string;
  scope: "MATCH" | "SERIES";
  description: string;
  categoryLabel: string;
  difficultyLabel: string;
  status: string;
  points: number | null;
};

export type PlayerProfileData = {
  userId: string;
  pseudo: string;
  isAdmin: boolean;
  isInactive: boolean;
  favoriteTeam: TeamRef | null;
  bio: string;
  pinnedBadges: BadgeDisplay[];
  competitionId: string | null;
  competitionName: string | null;
  rank: number | null;
  totalPoints: number | null;
  isBracketRevealed: boolean;
  bracketDeadline: string | null;
  bracketPicks: PlayerProfileBracketPick[]; // vide si pas révélé ou aucun bracket
  matchPredictions: PlayerProfileMatchPrediction[]; // récentes d'abord
  bets: PlayerProfileBet[];
};

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export async function getPlayerProfile(userId: string): Promise<PlayerProfileData | null> {
  const supabase = await getServerClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, pseudo, role, status, favorite_team_id, bio")
    .eq("id", userId)
    .maybeSingle<{
      id: string;
      pseudo: string;
      role: "PLAYER" | "ADMIN";
      status: "ACTIVE" | "DISABLED";
      favorite_team_id: string | null;
      bio: string | null;
    }>();
  if (!profile) return null;

  const [favoriteTeam, badges] = await Promise.all([
    profile.favorite_team_id ? fetchTeam(supabase, profile.favorite_team_id) : Promise.resolve(null),
    getProfileBadges(userId),
  ]);

  const base = {
    userId: profile.id,
    pseudo: profile.pseudo,
    isAdmin: profile.role === "ADMIN",
    isInactive: profile.status === "DISABLED",
    favoriteTeam,
    bio: profile.bio ?? "",
    pinnedBadges: badges.pinnedBadges,
  };

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, bracket_deadline")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; name: string; bracket_deadline: string | null }>();

  if (!competition) {
    return {
      ...base,
      competitionId: null,
      competitionName: null,
      rank: null,
      totalPoints: null,
      isBracketRevealed: false,
      bracketDeadline: null,
      bracketPicks: [],
      matchPredictions: [],
      bets: [],
    };
  }

  const isBracketRevealed =
    competition.bracket_deadline !== null && Date.parse(competition.bracket_deadline) <= Date.now();

  const [rank, matchPredictions, bracketPicks, bets] = await Promise.all([
    fetchRank(supabase, competition.id, userId),
    fetchMatchPredictions(supabase, competition.id, userId),
    isBracketRevealed ? fetchBracketPicks(supabase, competition.id, userId) : Promise.resolve([]),
    fetchPublicBets(supabase, competition.id, userId),
  ]);

  const { data: scoreRow } = await supabase
    .from("user_scores")
    .select("total_points")
    .eq("competition_id", competition.id)
    .eq("user_id", userId)
    .maybeSingle<{ total_points: number }>();

  return {
    ...base,
    competitionId: competition.id,
    competitionName: competition.name,
    rank,
    totalPoints: scoreRow?.total_points ?? null,
    isBracketRevealed,
    bracketDeadline: competition.bracket_deadline,
    bracketPicks,
    matchPredictions,
    bets,
  };
}

async function fetchTeam(supabase: SupabaseServerClient, teamId: string): Promise<TeamRef | null> {
  const { data } = await supabase.from("teams").select("id, abbreviation, name").eq("id", teamId).maybeSingle();
  return data ? { id: data.id, abbreviation: data.abbreviation, name: data.name } : null;
}

async function fetchRank(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("user_scores")
    .select("user_id, total_points, correct_match_winners, exact_margins, bracket_points")
    .eq("competition_id", competitionId);
  if (!data || data.length === 0) return null;
  const ranks = assignRanks(data as RankableScore[]);
  return ranks.get(userId) ?? null;
}

async function fetchMatchPredictions(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<PlayerProfileMatchPrediction[]> {
  // Ancré sur les matchs VERROUILLÉS uniquement (même garde que Mes pronos) —
  // filtré ICI, pas seulement par la RLS (§ commentaire de tête), pour rester
  // cohérent quel que soit le visiteur. Même patron 2-requêtes que tout le
  // reste du projet (matches puis pronos), pas de filtre imbriqué PostgREST.
  const { data: lockedMatchesData } = await supabase
    .from("matches")
    .select("id, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", new Date().toISOString());

  type MatchRow = { id: string; scheduled_at: string; home_team_id: string | null; away_team_id: string | null };
  const lockedMatches = (lockedMatchesData ?? []) as MatchRow[];
  if (lockedMatches.length === 0) return [];
  const matchById = new Map(lockedMatches.map((m) => [m.id, m]));

  const { data } = await supabase
    .from("match_predictions")
    .select("match_id, predicted_winner_team_id, predicted_margin, points_awarded, scored_at, corrected_by_admin_id, correction_reason")
    .eq("user_id", userId)
    .eq("competition_id", competitionId)
    .neq("status", "DRAFT")
    .not("predicted_winner_team_id", "is", null)
    .in("match_id", lockedMatches.map((m) => m.id));

  type Row = {
    match_id: string;
    predicted_winner_team_id: string;
    predicted_margin: number;
    points_awarded: number | null;
    scored_at: string | null;
    corrected_by_admin_id: string | null;
    correction_reason: string | null;
  };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  const teamIds = new Set<string>();
  for (const row of rows) {
    teamIds.add(row.predicted_winner_team_id);
    const match = matchById.get(row.match_id)!;
    if (match.home_team_id) teamIds.add(match.home_team_id);
    if (match.away_team_id) teamIds.add(match.away_team_id);
  }
  const adminIds = [...new Set(rows.filter((r) => r.corrected_by_admin_id).map((r) => r.corrected_by_admin_id!))];

  const [teams, admins] = await Promise.all([
    fetchTeamsMap(supabase, [...teamIds]),
    fetchPseudoMap(supabase, adminIds),
  ]);

  return rows
    .map((row) => {
      const match = matchById.get(row.match_id)!;
      return {
        matchId: row.match_id,
        homeTeam: teams.get(match.home_team_id ?? "") ?? unknownTeam(),
        awayTeam: teams.get(match.away_team_id ?? "") ?? unknownTeam(),
        scheduledAt: match.scheduled_at,
        predictedWinner: teams.get(row.predicted_winner_team_id) ?? unknownTeam(),
        predictedMargin: row.predicted_margin,
        points: row.scored_at === null ? null : row.points_awarded,
        adminCorrection: toAdminCorrection(row.corrected_by_admin_id, row.correction_reason, admins),
      };
    })
    .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt));
}

async function fetchBracketPicks(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<PlayerProfileBracketPick[]> {
  const { data: bracket } = await supabase
    .from("brackets")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  if (!bracket) return [];

  const [{ data: series }, { data: picksData }] = await Promise.all([
    supabase
      .from("series")
      .select("id, round, team1_id, team2_id, official_winner_team_id")
      .eq("competition_id", competitionId),
    supabase
      .from("bracket_picks")
      .select("series_id, predicted_winner_team_id, predicted_score_format, points_awarded, scored_at")
      .eq("bracket_id", bracket.id),
  ]);

  type SeriesRow = {
    id: string;
    round: string;
    team1_id: string | null;
    team2_id: string | null;
    official_winner_team_id: string | null;
  };
  const seriesRows = (series ?? []) as SeriesRow[];
  if (seriesRows.length === 0) return [];

  const picksBySeriesId = new Map(
    ((picksData ?? []) as {
      series_id: string;
      predicted_winner_team_id: string | null;
      predicted_score_format: string | null;
      points_awarded: number | null;
      scored_at: string | null;
    }[]).map((p) => [p.series_id, p])
  );

  const teamIds = new Set<string>();
  for (const row of seriesRows) {
    if (row.team1_id) teamIds.add(row.team1_id);
    if (row.team2_id) teamIds.add(row.team2_id);
    if (row.official_winner_team_id) teamIds.add(row.official_winner_team_id);
  }
  for (const pick of picksBySeriesId.values()) {
    if (pick.predicted_winner_team_id) teamIds.add(pick.predicted_winner_team_id);
  }
  const teams = await fetchTeamsMap(supabase, [...teamIds]);

  return seriesRows
    .map((row) => {
      const pick = picksBySeriesId.get(row.id);
      return {
        seriesId: row.id,
        round: row.round,
        roundLabel: ROUND_LABELS[row.round] ?? row.round,
        teamA: row.team1_id ? (teams.get(row.team1_id) ?? null) : null,
        teamB: row.team2_id ? (teams.get(row.team2_id) ?? null) : null,
        predictedWinner: pick?.predicted_winner_team_id ? (teams.get(pick.predicted_winner_team_id) ?? null) : null,
        predictedScoreFormat: pick?.predicted_score_format ?? null,
        actualWinnerAbbreviation: row.official_winner_team_id
          ? (teams.get(row.official_winner_team_id)?.abbreviation ?? null)
          : null,
        points: pick?.scored_at ? pick.points_awarded : null,
      };
    })
    .sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round));
}

const ROUND_ORDER = ["ROUND_1", "CONF_SEMIS", "CONF_FINALS", "NBA_FINALS", "CUP_QUARTERS", "CUP_SEMIS", "CUP_FINAL"];

async function fetchPublicBets(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<PlayerProfileBet[]> {
  const { data } = await supabase
    .from("bets")
    .select(
      "id, scope, series_id, match_id, description, validated_category, proposed_category, validated_difficulty, proposed_difficulty, status, points_awarded, scored_at"
    )
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .in("status", ["VALIDATED", "WON", "LOST"]);

  type BetRow = {
    id: string;
    scope: "MATCH" | "SERIES";
    series_id: string;
    match_id: string | null;
    description: string;
    validated_category: BetCategory | null;
    proposed_category: BetCategory;
    validated_difficulty: BetDifficulty | null;
    proposed_difficulty: BetDifficulty;
    status: string;
    points_awarded: number | null;
    scored_at: string | null;
  };
  const bets = (data ?? []) as BetRow[];
  if (bets.length === 0) return [];

  // "Public" = statut public ET deadline passée (bet_is_public, RLS T3) —
  // filtré ICI aussi (pas seulement RLS) pour une vue cohérente quel que
  // soit le visiteur (§ commentaire de tête).
  const matchIds = [...new Set(bets.filter((b) => b.match_id).map((b) => b.match_id!))];
  const seriesIds = [...new Set(bets.map((b) => b.series_id))];

  const [{ data: targetMatches }, { data: seriesMatches }] = await Promise.all([
    matchIds.length > 0
      ? supabase.from("matches").select("id, scheduled_at").in("id", matchIds)
      : Promise.resolve({ data: [] as { id: string; scheduled_at: string | null }[] }),
    supabase
      .from("matches")
      .select("series_id, scheduled_at")
      .in("series_id", seriesIds)
      .not("scheduled_at", "is", null),
  ]);

  const matchDeadline = new Map((targetMatches ?? []).map((m) => [m.id as string, m.scheduled_at as string | null]));
  const seriesFirstMatch = new Map<string, string>();
  for (const m of seriesMatches ?? []) {
    const seriesId = m.series_id as string;
    const scheduledAt = m.scheduled_at as string;
    const current = seriesFirstMatch.get(seriesId);
    if (!current || scheduledAt < current) seriesFirstMatch.set(seriesId, scheduledAt);
  }

  const nowMs = Date.now();
  const publicBets = bets.filter((bet) => {
    const deadline = bet.scope === "MATCH" ? (matchDeadline.get(bet.match_id ?? "") ?? null) : (seriesFirstMatch.get(bet.series_id) ?? null);
    return deadline !== null && Date.parse(deadline) <= nowMs;
  });

  return publicBets.map((bet) => ({
    betId: bet.id,
    scope: bet.scope,
    description: bet.description,
    categoryLabel: BET_CATEGORY_LABELS[bet.validated_category ?? bet.proposed_category],
    difficultyLabel: BET_DIFFICULTY_LABELS[bet.validated_difficulty ?? bet.proposed_difficulty],
    status: bet.status,
    points: bet.scored_at === null ? null : bet.points_awarded,
  }));
}

async function fetchTeamsMap(supabase: SupabaseServerClient, ids: string[]): Promise<Map<string, TeamRef>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("teams").select("id, abbreviation, name").in("id", ids);
  return new Map((data ?? []).map((t) => [t.id as string, { id: t.id as string, abbreviation: t.abbreviation as string, name: t.name as string }]));
}

async function fetchPseudoMap(supabase: SupabaseServerClient, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("users").select("id, pseudo").in("id", ids);
  return new Map((data ?? []).map((u) => [u.id as string, u.pseudo as string]));
}

function unknownTeam(): TeamRef {
  return { id: "", abbreviation: "?", name: "?" };
}
