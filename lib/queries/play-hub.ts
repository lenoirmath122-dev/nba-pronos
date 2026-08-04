import { getServerClient } from "@/lib/supabase/server";
import { getBracketFillData } from "@/lib/queries/bracket-fill";
import { getRemainingSeriesBets } from "@/lib/queries/series-bets";

// Lecture du hub Jouer (SPEC_ECRAN_HUB_JOUER_V0_1 §2/§4). Un instantané TRÈS
// LÉGER par carte — pas de réutilisation des requêtes complètes des écrans
// dédiés (Matchs/Mes pronos/Paris), qui portent bien plus que nécessaire ici
// (others/absentees, historique complet, quotas détaillés...).
//
// EXCEPTION assumée : la carte Bracket réutilise directement
// getBracketFillData() pour filledCount/totalCount/deadline plutôt qu'une
// requête dédiée — logique non triviale déjà correcte et testée (leçon
// retenue, SPEC_ECRAN_BRACKET_PERSONNEL §0) ; la dupliquer ici pour économiser
// quelques colonnes créerait un vrai risque de divergence pour un gain de
// perf négligeable (une seule compétition, 15 séries au plus). En revanche
// remainingSeriesBets vient de lib/queries/series-bets.ts (VRAIES équipes
// qualifiées, pas les picks du joueur) — bug corrigé le 04/08/2026, voir ce
// module pour le détail.

const MATCHES_WINDOW_DAYS = 3;
const BRACKET_NEAR_DEADLINE_MS = 2 * 24 * 60 * 60 * 1000; // 2 jours, même seuil que §2.3 de la spec

export type PlayHubMatchesCard = {
  todoCount: number;
  nextMatch: { homeAbbreviation: string; awayAbbreviation: string; scheduledAt: string } | null;
};

export type PlayHubPredictionsCard = {
  lastScored: { teamAbbreviation: string; margin: number; isWin: boolean; points: number } | null;
};

export type PlayHubBracketCard = {
  filledCount: number;
  totalCount: number;
  deadline: string | null;
  isNearDeadline: boolean;
  isActionable: boolean;
  /** Nombre de séries où un pari série reste possible et pas encore posé
   *  (demandé par l'utilisateur 28/07/2026) — toujours 0 en NBA Cup. */
  remainingSeriesBets: number;
};

export type PlayHubBetsCard = {
  draftCount: number;
  submittedCount: number;
};

export type PlayHubData = {
  matches: PlayHubMatchesCard;
  predictions: PlayHubPredictionsCard;
  bracket: PlayHubBracketCard;
  bets: PlayHubBetsCard;
};

type CompetitionRow = { id: string };
type TeamRow = { id: string; abbreviation: string };

async function getMatchesCard(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  userId: string,
  competitionId: string
): Promise<PlayHubMatchesCard> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowEndIso = new Date(nowMs + MATCHES_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Même fenêtre que l'écran Matchs (scheduled_at uniquement, jamais status —
  // SPEC_ECRAN_MATCHS_V0_1 §2/§18.2).
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", nowIso)
    .lte("scheduled_at", windowEndIso)
    .order("scheduled_at", { ascending: true });

  type MatchRow = { id: string; scheduled_at: string; home_team_id: string | null; away_team_id: string | null };
  const matches = (matchesData ?? []) as MatchRow[];
  if (matches.length === 0) return { todoCount: 0, nextMatch: null };

  const matchIds = matches.map((m) => m.id);
  const { data: ownData } = await supabase
    .from("match_predictions")
    .select("match_id, predicted_winner_team_id, predicted_margin, status")
    .eq("user_id", userId)
    .in("match_id", matchIds);

  type OwnRow = { match_id: string; predicted_winner_team_id: string | null; predicted_margin: number | null; status: string };
  const ownByMatchId = new Map(((ownData ?? []) as OwnRow[]).map((row) => [row.match_id, row]));

  // Même dérivation que PredictionViewStatus (lib/queries/matches.ts) —
  // "à faire" = tout ce qui n'est pas VALIDATED (TODO/INCOMPLETE/READY).
  const todoCount = matches.filter((match) => {
    const own = ownByMatchId.get(match.id);
    return !own || own.status !== "VALIDATED";
  }).length;

  if (todoCount === 0) return { todoCount: 0, nextMatch: null };

  const { data: teamsData } = await supabase.from("teams").select("id, abbreviation");
  const abbreviationById = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, t.abbreviation]));

  const soonest = matches[0]; // déjà trié par scheduled_at croissant
  return {
    todoCount,
    nextMatch: {
      homeAbbreviation: (soonest.home_team_id && abbreviationById.get(soonest.home_team_id)) ?? "?",
      awayAbbreviation: (soonest.away_team_id && abbreviationById.get(soonest.away_team_id)) ?? "?",
      scheduledAt: soonest.scheduled_at,
    },
  };
}

async function getPredictionsCard(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  userId: string
): Promise<PlayHubPredictionsCard> {
  const { data } = await supabase
    .from("match_predictions")
    .select("predicted_winner_team_id, predicted_margin, is_winner_correct, winner_points, margin_bonus_points")
    .eq("user_id", userId)
    .not("scored_at", "is", null)
    .order("scored_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      predicted_winner_team_id: string | null;
      predicted_margin: number | null;
      is_winner_correct: boolean | null;
      winner_points: number | null;
      margin_bonus_points: number | null;
    }>();

  if (!data || data.predicted_winner_team_id === null || data.predicted_margin === null) {
    return { lastScored: null };
  }

  const { data: teamData } = await supabase
    .from("teams")
    .select("abbreviation")
    .eq("id", data.predicted_winner_team_id)
    .single<{ abbreviation: string }>();

  return {
    lastScored: {
      teamAbbreviation: teamData?.abbreviation ?? "?",
      margin: data.predicted_margin,
      isWin: data.is_winner_correct === true,
      points: (data.winner_points ?? 0) + (data.margin_bonus_points ?? 0),
    },
  };
}

async function getBracketCard(): Promise<PlayHubBracketCard> {
  const [data, remainingSeriesBets] = await Promise.all([getBracketFillData(), getRemainingSeriesBets()]);
  const isActionable = data.competitionId !== null && data.isStructureKnown && !data.isDeadlinePassed;
  const isNearDeadline =
    isActionable && data.deadline !== null && Date.parse(data.deadline) - Date.now() < BRACKET_NEAR_DEADLINE_MS;

  return {
    filledCount: data.filledCount,
    totalCount: data.totalCount,
    deadline: data.deadline,
    isNearDeadline,
    isActionable,
    remainingSeriesBets: remainingSeriesBets.length,
  };
}

async function getBetsCard(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  userId: string,
  competitionId: string
): Promise<PlayHubBetsCard> {
  const { data } = await supabase
    .from("bets")
    .select("status")
    .eq("user_id", userId)
    .eq("competition_id", competitionId)
    .in("status", ["DRAFT", "SUBMITTED"]);

  type StatusRow = { status: "DRAFT" | "SUBMITTED" };
  const rows = (data ?? []) as StatusRow[];
  return {
    draftCount: rows.filter((r) => r.status === "DRAFT").length,
    submittedCount: rows.filter((r) => r.status === "SUBMITTED").length,
  };
}

function emptyMatches(): PlayHubMatchesCard {
  return { todoCount: 0, nextMatch: null };
}
function emptyPredictions(): PlayHubPredictionsCard {
  return { lastScored: null };
}
function emptyBets(): PlayHubBetsCard {
  return { draftCount: 0, submittedCount: 0 };
}

export async function getPlayHubData(): Promise<PlayHubData> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const bracket = await getBracketCard(); // gère elle-même l'absence de compétition/session (emptyData()).

  if (!user) {
    return { matches: emptyMatches(), predictions: emptyPredictions(), bracket, bets: emptyBets() };
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  const predictions = await getPredictionsCard(supabase, user.id);

  if (!competition) {
    return { matches: emptyMatches(), predictions, bracket, bets: emptyBets() };
  }

  const [matches, bets] = await Promise.all([
    getMatchesCard(supabase, user.id, competition.id),
    getBetsCard(supabase, user.id, competition.id),
  ]);

  return { matches, predictions, bracket, bets };
}
