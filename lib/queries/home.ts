import { getServerClient } from "@/lib/supabase/server";
import { getBracketFillData, getRemainingSeriesBets } from "@/lib/queries/bracket-fill";
import { ROUND_LABELS } from "@/lib/labels/rounds";

// Lecture de l'écran Accueil (composants serveur uniquement), SPEC_ECRAN_ACCUEIL
// §7. Un seul module, appelé avec getServerClient() : les requêtes passent par
// la RLS (jamais service_role), qui reste seule autorité de visibilité (P1).
// Le tri d'urgence et les libellés sont produits ICI ; components/home/* ne
// font que rendre les valeurs déjà calculées.

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

/** Mouvement de rang : non alimenté en V1 (aucun historique de rang). Slot réservé. */
export type RankMovement = { from: number; to: number; delta: number };

export type HomeHeader = {
  pseudo: string;
  competitionName: string;
  rank: number | null;
  totalPoints: number;
  pointsBehindLeader: number | null;
  recentFormPoints: number;
  rankMovement: RankMovement | null; // TOUJOURS null en V1
};

export type TodoItem = {
  kind: "bracket" | "matches" | "bets" | "admin_bet_review";
  title: string;
  subtitle: string | null;
  deadline: string | null;
  count: number;
  href: string;
};

export type FeedItem = {
  kind: "match_scored" | "bet_scored" | "bet_resolved";
  label: string;
  detail: string | null;
  points: number | null;
  outcome: "win" | "loss" | "neutral";
  occurredAt: string;
};

/** Un item de la section « Paris séries » (demandée par l'utilisateur
 *  28/07/2026) — LISTE chaque série individuellement (contrairement à
 *  TodoItem, qui agrège), donc un type dédié plutôt qu'un TodoItem détourné. */
export type SeriesBetTodoItem = { seriesId: string; title: string; href: string };

export type HomeData = {
  competitionId: string | null;
  header: HomeHeader | null;
  todo: TodoItem[];
  adminTodo: TodoItem[];
  seriesBets: SeriesBetTodoItem[];
  feed: FeedItem[];
};

/** Fenêtre et taille du feed « Ça vient de tomber » (spec §6) — ajustables ici uniquement. */
export const FEED_WINDOW_HOURS = 48;
export const FEED_MAX_ITEMS = 5;

const EMPTY_HOME_DATA: HomeData = {
  competitionId: null,
  header: null,
  todo: [],
  adminTodo: [],
  seriesBets: [],
  feed: [],
};

type CompetitionRow = {
  id: string;
  name: string;
  type: "PLAYOFFS" | "NBA_CUP";
  bracket_deadline: string | null;
};

export async function getHomeData(): Promise<HomeData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Ne devrait pas se produire : le layout (app) garde déjà la session.
    return EMPTY_HOME_DATA;
  }

  // Une seule compétition ACTIVE à la fois (contrainte d'unicité en base) —
  // aucune active → état vide global (§2).
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, type, bracket_deadline")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    return EMPTY_HOME_DATA;
  }

  const [header, todo, adminTodo, seriesBets, feed] = await Promise.all([
    getHeader(supabase, competition, user.id),
    getTodo(supabase, competition, user.id),
    getAdminTodo(supabase, competition.id),
    getSeriesBetsTodo(),
    getFeed(supabase, competition.id, user.id),
  ]);

  return { competitionId: competition.id, header, todo, adminTodo, seriesBets, feed };
}

// ============================================================================
// « Paris séries » (demandé par l'utilisateur 28/07/2026) — liste chaque
// série où un pari reste possible et pas encore posé ; section RETIRÉE dès
// que la liste est vide (jamais un état vide affiché, contrairement à « À
// traiter »/« Ça vient de tomber »). Réutilise getBracketFillData() +
// getRemainingSeriesBets() (lib/queries/bracket-fill.ts) — même logique que
// la carte Bracket du hub Jouer, jamais recalculée deux fois.
// ============================================================================

async function getSeriesBetsTodo(): Promise<SeriesBetTodoItem[]> {
  const data = await getBracketFillData();
  return getRemainingSeriesBets(data).map((series) => ({
    seriesId: series.seriesId,
    title: `${ROUND_LABELS[series.round] ?? series.round} — ${series.teamA?.abbreviation} vs ${series.teamB?.abbreviation}`,
    href: `/play/bracket#series-${series.seriesId}`,
  }));
}

// ============================================================================
// En-tête (§3)
// ============================================================================

async function getHeader(
  supabase: SupabaseServerClient,
  competition: CompetitionRow,
  userId: string
): Promise<HomeHeader> {
  const [{ data: profile }, { data: scores }, { data: form }] = await Promise.all([
    supabase.from("users").select("pseudo").eq("id", userId).single(),
    supabase
      .from("user_scores")
      .select("user_id, total_points, correct_match_winners, exact_margins, bracket_points")
      .eq("competition_id", competition.id)
      // Ordre de classement (0.2.6 §3) : total, puis départages 2/3/4.
      .order("total_points", { ascending: false })
      .order("correct_match_winners", { ascending: false })
      .order("exact_margins", { ascending: false })
      .order("bracket_points", { ascending: false }),
    supabase
      .from("user_recent_form")
      .select("recent_form_points")
      .eq("competition_id", competition.id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const rows = scores ?? [];
  const rankIndex = rows.findIndex((row) => row.user_id === userId);
  const rank = rankIndex === -1 ? null : rankIndex + 1;
  const totalPoints = rank === null ? 0 : rows[rankIndex].total_points;
  const leaderPoints = rows.length > 0 ? rows[0].total_points : null;
  // null si leader ou non classé (§3).
  const pointsBehindLeader =
    rank === null || rank === 1 || leaderPoints === null
      ? null
      : leaderPoints - totalPoints;

  return {
    pseudo: profile?.pseudo ?? "",
    competitionName: competition.name,
    rank,
    totalPoints,
    pointsBehindLeader,
    recentFormPoints: form?.recent_form_points ?? 0,
    rankMovement: null, // TOUJOURS null en V1 (§3)
  };
}

// ============================================================================
// « À traiter » (§4) — tri par deadline la plus proche, égalité départagée
// par urgence bracket > matchs > paris.
// ============================================================================

const TODO_URGENCY: Record<TodoItem["kind"], number> = {
  bracket: 0,
  matches: 1,
  bets: 2,
  admin_bet_review: 3,
};

function sortTodoItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => {
    const timeA = a.deadline ? Date.parse(a.deadline) : Number.POSITIVE_INFINITY;
    const timeB = b.deadline ? Date.parse(b.deadline) : Number.POSITIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    return TODO_URGENCY[a.kind] - TODO_URGENCY[b.kind];
  });
}

async function getTodo(
  supabase: SupabaseServerClient,
  competition: CompetitionRow,
  userId: string
): Promise<TodoItem[]> {
  const items: TodoItem[] = [];

  const bracketItem = await getBracketTodo(supabase, competition, userId);
  if (bracketItem) items.push(bracketItem);

  const matchesItem = await getMatchesTodo(supabase, competition.id, userId);
  if (matchesItem) items.push(matchesItem);

  const betsItem = await getBetsTodo(supabase, competition.id, userId);
  if (betsItem) items.push(betsItem);

  return sortTodoItems(items);
}

async function getBracketTodo(
  supabase: SupabaseServerClient,
  competition: CompetitionRow,
  userId: string
): Promise<TodoItem | null> {
  // Pas de deadline connue : rien à afficher (déduction de session, voir résumé).
  if (!competition.bracket_deadline) return null;
  if (Date.parse(competition.bracket_deadline) <= Date.now()) return null;

  const { data: series } = await supabase
    .from("series")
    .select("id")
    .eq("competition_id", competition.id);

  const totalSlots = series?.length ?? 0;
  // NBA Cup avant fin novembre : mini-bracket pas encore ouvert, aucune série
  // en base → pas d'item, ce n'est pas un état vide à signaler (§4).
  if (totalSlots === 0) return null;

  const { data: bracket } = await supabase
    .from("brackets")
    .select("id")
    .eq("competition_id", competition.id)
    .eq("user_id", userId)
    .maybeSingle();

  let completed = 0;
  if (bracket) {
    const { data: picks } = await supabase
      .from("bracket_picks")
      .select("predicted_winner_team_id, predicted_score_format")
      .eq("bracket_id", bracket.id);

    completed = (picks ?? []).filter((pick) =>
      competition.type === "PLAYOFFS"
        ? pick.predicted_winner_team_id !== null && pick.predicted_score_format !== null
        : pick.predicted_winner_team_id !== null
    ).length;
  }

  if (completed >= totalSlots) return null; // bracket complet

  const title =
    competition.type === "PLAYOFFS"
      ? `Complète ton bracket · ${totalSlots} séries`
      : `Complète ton bracket · ${totalSlots} matchs de phase finale`;

  return {
    kind: "bracket",
    title,
    subtitle: null,
    deadline: competition.bracket_deadline,
    count: totalSlots - completed,
    href: "/play/bracket",
  };
}

async function getMatchesTodo(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<TodoItem | null> {
  const nowIso = new Date().toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .eq("status", "SCHEDULED")
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });

  if (!matches || matches.length === 0) return null;

  const matchIds = matches.map((match) => match.id as string);
  const { data: predictions } = await supabase
    .from("match_predictions")
    .select("match_id, status")
    .eq("user_id", userId)
    .in("match_id", matchIds);

  const validatedMatchIds = new Set(
    (predictions ?? [])
      .filter((prediction) => prediction.status === "VALIDATED")
      .map((prediction) => prediction.match_id as string)
  );

  const pending = matches.filter((match) => !validatedMatchIds.has(match.id as string));
  if (pending.length === 0) return null;

  const nextMatch = pending[0]; // déjà trié par scheduled_at croissant
  const subtitle = await describeUpcomingMatch(supabase, nextMatch);

  return {
    kind: "matches",
    title: `${pending.length} match${pending.length > 1 ? "s" : ""} à pronostiquer`,
    subtitle,
    deadline: nextMatch.scheduled_at as string,
    count: pending.length,
    href: "/play/matches",
  };
}

async function describeUpcomingMatch(
  supabase: SupabaseServerClient,
  match: { home_team_id: string | null; away_team_id: string | null }
): Promise<string | null> {
  const teamIds = [match.home_team_id, match.away_team_id].filter(
    (id): id is string => id !== null
  );
  if (teamIds.length !== 2) return null;

  const { data: teams } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", teamIds);

  const abbrevOf = (id: string) =>
    (teams ?? []).find((team) => team.id === id)?.abbreviation ?? "?";

  return `Prochain : ${abbrevOf(match.home_team_id as string)} - ${abbrevOf(match.away_team_id as string)}`;
}

async function getBetsTodo(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<TodoItem | null> {
  // Brouillons pas encore soumis, ou paris refusés dont le slot redevient
  // reproposable avant sa deadline (0.2.4 §6).
  const { data: bets } = await supabase
    .from("bets")
    .select("id, scope, series_id, match_id, status")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .in("status", ["DRAFT", "REJECTED"]);

  if (!bets || bets.length === 0) return null;

  const matchIds = [
    ...new Set(bets.filter((bet) => bet.match_id).map((bet) => bet.match_id as string)),
  ];
  const seriesIds = [...new Set(bets.map((bet) => bet.series_id as string))];

  const [{ data: targetMatches }, { data: seriesMatches }] = await Promise.all([
    matchIds.length > 0
      ? supabase.from("matches").select("id, scheduled_at").in("id", matchIds)
      : Promise.resolve({ data: [] as { id: string; scheduled_at: string | null }[] }),
    seriesIds.length > 0
      ? supabase
          .from("matches")
          .select("series_id, scheduled_at")
          .in("series_id", seriesIds)
          .not("scheduled_at", "is", null)
      : Promise.resolve({ data: [] as { series_id: string; scheduled_at: string | null }[] }),
  ]);

  const matchDeadline = new Map(
    (targetMatches ?? []).map((match) => [match.id as string, match.scheduled_at as string | null])
  );
  const seriesFirstMatch = new Map<string, string>();
  for (const match of seriesMatches ?? []) {
    const seriesId = match.series_id as string;
    const scheduledAt = match.scheduled_at as string;
    const current = seriesFirstMatch.get(seriesId);
    if (!current || scheduledAt < current) {
      seriesFirstMatch.set(seriesId, scheduledAt);
    }
  }

  // Reproduit public.bet_deadline_open() (T3 §2) : MATCH → coup d'envoi du
  // match visé ; SÉRIE → coup d'envoi du 1er match de la série.
  const nowMs = Date.now();
  const openBets = bets.flatMap((bet) => {
    const deadline =
      bet.scope === "MATCH"
        ? matchDeadline.get((bet.match_id as string) ?? "") ?? null
        : seriesFirstMatch.get(bet.series_id as string) ?? null;
    if (!deadline || Date.parse(deadline) <= nowMs) return [];
    return [{ deadline }];
  });

  if (openBets.length === 0) return null;

  const nearestDeadline = openBets.reduce(
    (min, bet) => (bet.deadline < min ? bet.deadline : min),
    openBets[0].deadline
  );

  return {
    kind: "bets",
    title: `${openBets.length} pari${openBets.length > 1 ? "s" : ""} à finaliser`,
    subtitle: "Brouillons ou paris à reproposer avant leur deadline.",
    deadline: nearestDeadline,
    count: openBets.length,
    href: "/play/bets",
  };
}

// ============================================================================
// « À traiter (admin) » (§5) — jamais mélangé au tri joueur.
// ============================================================================

async function getAdminTodo(
  supabase: SupabaseServerClient,
  competitionId: string
): Promise<TodoItem[]> {
  // Vérification serveur du rôle (jamais un état client, P1).
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return [];

  const { count } = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("status", "SUBMITTED");

  if (!count) return [];

  return [
    {
      kind: "admin_bet_review",
      title: `${count} pari${count > 1 ? "s" : ""} à valider`,
      subtitle: null,
      deadline: null,
      count,
      href: "/admin/validation",
    },
  ];
}

// ============================================================================
// « Ça vient de tomber » (§6)
// ============================================================================

type MatchScoreRow = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

async function getFeed(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string
): Promise<FeedItem[]> {
  const since = new Date(Date.now() - FEED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const [{ data: scoredPredictions }, { data: scoredBets }, { data: resolvedBets }] =
    await Promise.all([
      supabase
        .from("match_predictions")
        .select("match_id, points_awarded, is_winner_correct, margin_diff, scored_at")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .not("scored_at", "is", null)
        .gte("scored_at", since),
      supabase
        .from("bets")
        .select("id, description, points_awarded, status, scored_at")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .in("status", ["WON", "LOST"])
        .not("scored_at", "is", null)
        .gte("scored_at", since),
      // « Pari statué par l'admin » = pari ANNULÉ/neutralisé (resolved_at) —
      // WON/LOST sont déjà couverts ci-dessus comme résultat (§6, décision
      // de session : lecture littérale de la colonne resolved_at + cohérence
      // avec la règle « neutralisé, jamais rouge » de 0.2.4/0.2.9/T6c).
      supabase
        .from("bets")
        .select("id, description, points_awarded, resolution_reason, resolved_at")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .eq("status", "CANCELLED")
        .not("resolved_at", "is", null)
        .gte("resolved_at", since),
    ]);

  const matchIds = [...new Set((scoredPredictions ?? []).map((p) => p.match_id as string))];
  const { data: matches } =
    matchIds.length > 0
      ? await supabase
          .from("matches")
          .select("id, home_team_id, away_team_id, home_score, away_score")
          .in("id", matchIds)
      : { data: [] as MatchScoreRow[] };

  const teamIds = [
    ...new Set(
      (matches ?? [])
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is string => id !== null)
    ),
  ];
  const { data: teams } =
    teamIds.length > 0
      ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds)
      : { data: [] as { id: string; abbreviation: string }[] };

  const teamAbbrev = (id: string | null) =>
    id ? (teams ?? []).find((team) => team.id === id)?.abbreviation ?? "?" : "?";
  const matchById = new Map((matches ?? []).map((match) => [match.id, match as MatchScoreRow]));

  const matchItems: FeedItem[] = (scoredPredictions ?? []).map((prediction) => {
    const match = matchById.get(prediction.match_id as string);
    const label = match
      ? `${teamAbbrev(match.home_team_id)} ${match.home_score ?? "-"} - ${match.away_score ?? "-"} ${teamAbbrev(match.away_team_id)}`
      : "Match scoré";
    const detail = prediction.margin_diff === 0 ? "Écart exact" : prediction.is_winner_correct ? "Bon vainqueur" : "Mauvais vainqueur";
    return {
      kind: "match_scored",
      label,
      detail,
      points: prediction.points_awarded,
      outcome: prediction.is_winner_correct ? "win" : "loss",
      occurredAt: prediction.scored_at as string,
    };
  });

  const betScoredItems: FeedItem[] = (scoredBets ?? []).map((bet) => ({
    kind: "bet_scored",
    label: bet.description as string,
    detail: null,
    points: bet.points_awarded,
    outcome: bet.status === "WON" ? "win" : "loss",
    occurredAt: bet.scored_at as string,
  }));

  const betResolvedItems: FeedItem[] = (resolvedBets ?? []).map((bet) => ({
    kind: "bet_resolved",
    label: bet.description as string,
    detail: bet.resolution_reason ? `Neutralisé : ${bet.resolution_reason}` : "Neutralisé",
    points: bet.points_awarded,
    outcome: "neutral",
    occurredAt: bet.resolved_at as string,
  }));

  return [...matchItems, ...betScoredItems, ...betResolvedItems]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, FEED_MAX_ITEMS);
}
