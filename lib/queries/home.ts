import { getServerClient } from "@/lib/supabase/server";
import { getActiveCompetition } from "@/lib/cache/commonData";
import { hiddenSeriesFilter } from "@/lib/queries/dailyVisibility";
import { getAllTeams } from "@/lib/queries/teams";
import { getRemainingSeriesBets } from "@/lib/queries/series-bets";
import { getRemainingMatchBets } from "@/lib/queries/match-bets";
import { getUserSeenState } from "@/lib/queries/seen";
import {
  getChatPreview,
  getChatReadStatus,
  getRecentChatActivity,
  type ChatActivity,
  type ChatPreviewMessage,
  type ChatReadStatus,
} from "@/lib/queries/chat";
import { parisDateKey } from "@/lib/dates/paris";
import { computeBetDeadlines } from "@/lib/scoring/bet-deadline";
import { assignRanks } from "@/lib/scoring/ranking";
import { getHomeRecap, getPastNightView, type HomeRecap, type RecapView } from "@/lib/recaps/home";
import { addDays, dailyPeriod, pastDailyPeriod } from "@/lib/recaps/period";
import { reactionKey, summarizeReactions, type ReactionRow, type ReactionSummary } from "@/lib/recaps/reactions";
import { readWeeklyRankingFlag } from "@/lib/weekly/flag";
import { getWeeklyLeaderboard, type WeeklyLeaderboardData } from "@/lib/queries/weeklyLeaderboard";
import type { CompetitionType } from "@/lib/competitions/types";

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
  /** true : rang/points/écart sont ceux de la semaine en cours (classement hebdo actif). */
  weekly: boolean;
  totalPoints: number;
  pointsBehindLeader: number | null;
  recentFormPoints: number;
  rankMovement: RankMovement | null; // TOUJOURS null en V1
};

/** Une équipe du prochain match à pronostiquer — pastille (§16.1), pas du texte. */
export type TodoMatchupTeam = { abbreviation: string; name: string };

export type TodoItem = {
  kind: "bracket" | "matches" | "bets" | "admin_bet_review";
  title: string;
  subtitle: string | null;
  /** Prochain match (kind "matches" uniquement) : pastilles d'équipe plutôt
   *  que le texte "Prochain : BOS - ATL" — null pour les autres kinds, ou si
   *  les 2 équipes ne sont pas encore connues (mêmes conditions que l'ancien
   *  subtitle textuel qu'il remplace). `gameNumber` = numéro du match dans
   *  SA série (18/08/2026, demandé par l'utilisateur — "Game 3"). */
  matchup: { home: TodoMatchupTeam; away: TodoMatchupTeam; gameNumber: number } | null;
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
  /** Lien vers l'item d'origine (18/08/2026, demandé par l'utilisateur) —
   *  match_scored/bet MATCH -> /play/results#match-{id} (la cible est
   *  toujours FINISHED ici, donc toujours côté Résultats, §14 SPEC_REFONTE_
   *  ONGLET_JOUER) ; bet SERIES -> /bracket#series-{id}. null seulement si
   *  la cible n'a pas pu être retrouvée (garde défensive, ne devrait pas
   *  arriver en pratique). */
  href: string | null;
};


/** Une nuit du fil Actualité (13/11/2026) : le récap (null si rien ne s'est
 *  passé cette nuit-là), les paris tranchés du joueur sur la MÊME fenêtre, et
 *  les réactions aux highlights (clé reactionKey). */
export type NightBundle = {
  recapDate: string;
  view: RecapView | null;
  items: FeedItem[];
  reactions: Record<string, ReactionSummary>;
};

/** Nombre de nuits que le fil peut afficher (bouton « Nuit précédente »). */
export const MAX_NEWS_NIGHTS = 14;

export type HomeData = {
  competitionId: string | null;
  header: HomeHeader | null;
  /** Récap « Ta semaine » (lundi 10h → mardi 10h, hors classement hebdo). */
  weeklyRecap: RecapView | null;
  /** Nuit en cours (ou dernière nuit après 10h), puis les précédentes. */
  nights: NightBundle[];
  canLoadMoreNights: boolean;
  /** Plus récent résultat du joueur (48 h) : repère « vu » de la pastille. */
  latestFeedAt: string | null;
  chatPreview: ChatPreviewMessage[];
  /** Préférence de notification du COMPTE (p3-13) — lue même sans
   *  compétition active, la carte d'activation des notifications
   *  (components/home/PushPrompt.tsx) doit apparaître aussi pendant une
   *  pause entre deux compétitions. */
  notificationPreference: NotificationPreference;
};

export type NotificationPreference = "NONE" | "PUSH" | "EMAIL";

/** Fenêtre et taille du feed « Ça vient de tomber » (spec §6) — ajustables ici uniquement. */
export const FEED_WINDOW_HOURS = 48;
export const FEED_MAX_ITEMS = 5;

const EMPTY_HOME_DATA: HomeData = {
  competitionId: null,
  header: null,
  weeklyRecap: null,
  nights: [],
  canLoadMoreNights: false,
  latestFeedAt: null,
  chatPreview: [],
  notificationPreference: "NONE",
};

type CompetitionRow = {
  id: string;
  name: string;
  type: CompetitionType;
  bracket_deadline: string | null;
};

/** Écran Actualité (ex-Accueil, 13/11/2026). `nights` = nombre de nuits à
 *  afficher (1 = la nuit en cours seule), borné à MAX_NEWS_NIGHTS. Ce qui se
 *  joue (prochain prono, à faire, paris à proposer) vit sur Jouer. */
export async function getHomeData(options: { nights?: number } = {}): Promise<HomeData> {
  const nightCount = Math.min(MAX_NEWS_NIGHTS, Math.max(1, Math.floor(options.nights ?? 1)));
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
  const [competition, { data: prefRow }] = await Promise.all([
    getActiveCompetition(supabase),
    supabase
      .from("users")
      .select("notification_preference")
      .eq("id", user.id)
      .maybeSingle<{ notification_preference: NotificationPreference }>(),
  ]);
  const notificationPreference = prefRow?.notification_preference ?? "NONE";

  if (!competition) {
    return { ...EMPTY_HOME_DATA, notificationPreference, chatPreview: await getChatPreview() };
  }

  // Classement hebdo actif : rang et points de l'en-tête, rang du récap de la
  // nuit sont ceux de la semaine en cours, pas du général. Lu une seule fois.
  const weeklyPromise = readWeeklyRankingFlag(supabase, competition.id).then(async (weeklyRanking) => ({
    weeklyRanking,
    board: weeklyRanking
      ? await getWeeklyLeaderboard(supabase, { competitionId: competition.id, leagueId: null, userId: user.id })
      : null,
  }));

  const nowMs = Date.now();
  const current = dailyPeriod(nowMs);
  const pastDates = Array.from({ length: nightCount - 1 }, (_, index) => addDays(current.recapDate, -(index + 1)));

  const [header, recap, currentItems, pastNights, latestFeed, reactionRows, chatPreview] = await Promise.all([
    weeklyPromise.then(({ board }) => getHeader(supabase, competition, user.id, board)),
    weeklyPromise.then(async ({ weeklyRanking, board }) =>
      withWeeklyRank(await getHomeRecap(supabase, competition.id, user.id, nowMs, { weeklyRanking }), board),
    ),
    getFeed(supabase, competition.id, user.id, { night: current }),
    weeklyPromise.then(({ weeklyRanking }) =>
      Promise.all(
        pastDates.map(async (recapDate) => {
          const [view, items] = await Promise.all([
            getPastNightView(supabase, competition.id, user.id, recapDate, { weeklyRanking }),
            getFeed(supabase, competition.id, user.id, { night: pastDailyPeriod(recapDate) }),
          ]);
          return { recapDate, view, items };
        })
      )
    ),
    getFeed(supabase, competition.id, user.id, { maxItems: 1 }),
    supabase
      .from("recap_reactions")
      .select("recap_date, target, user_id, kind")
      .eq("competition_id", competition.id)
      .in("recap_date", [current.recapDate, ...pastDates])
      .then(({ data }) => (data ?? []) as ReactionRow[]),
    getChatPreview(),
  ]);

  const summaries = summarizeReactions(reactionRows, user.id);
  const withReactions = (night: Omit<NightBundle, "reactions">): NightBundle => ({
    ...night,
    reactions: Object.fromEntries(
      (["TOP_SCORERS", "BEST_BET"] as const).flatMap((target) => {
        const key = reactionKey(night.recapDate, target);
        const summary = summaries.get(key);
        return summary ? [[key, summary]] : [];
      })
    ),
  });

  return {
    competitionId: competition.id,
    header,
    weeklyRecap: recap.weekly,
    nights: [
      withReactions({ recapDate: current.recapDate, view: recap.daily, items: currentItems }),
      ...pastNights.map(withReactions),
    ],
    canLoadMoreNights: nightCount < MAX_NEWS_NIGHTS,
    latestFeedAt: latestFeed[0]?.occurredAt ?? null,
    chatPreview,
    notificationPreference,
  };
}

// ============================================================================
// En-tête (§3)
// ============================================================================

async function getHeader(
  supabase: SupabaseServerClient,
  competition: CompetitionRow,
  userId: string,
  weekly: WeeklyLeaderboardData | null
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
  // Même règle de rang que le classement, les stats et le panneau Profil
  // (assignRanks : ex-aequo = rang partagé). Avant, `position + 1` donnait un
  // rang de plus au 2e d'une égalité (« 8e » ici, « 7e » dans le panneau).
  const ranks = assignRanks(rows);
  const ownRow = rows.find((row) => row.user_id === userId);
  const rank = ownRow ? (ranks.get(userId) ?? null) : null;
  const totalPoints = ownRow?.total_points ?? 0;
  const leaderPoints = rows.length > 0 ? rows[0].total_points : null;
  // null si leader ou non classé (§3).
  const pointsBehindLeader =
    rank === null || rank === 1 || leaderPoints === null
      ? null
      : leaderPoints - totalPoints;

  if (weekly?.state === "ok") {
    const weeklyRows = weekly.rows;
    const weeklyRank = weekly.currentUserRank;
    const weeklyPoints = weeklyRows.find((row) => row.isCurrentUser)?.points ?? 0;
    const weeklyLeader = weeklyRows.length > 0 ? weeklyRows[0].points : null;
    return {
      pseudo: profile?.pseudo ?? "",
      competitionName: competition.name,
      weekly: true,
      rank: weeklyRank,
      totalPoints: weeklyPoints,
      pointsBehindLeader:
        weeklyRank === null || weeklyRank === 1 || weeklyLeader === null ? null : weeklyLeader - weeklyPoints,
      recentFormPoints: form?.recent_form_points ?? 0,
      rankMovement: null,
    };
  }

  return {
    pseudo: profile?.pseudo ?? "",
    competitionName: competition.name,
    weekly: false,
    rank,
    totalPoints,
    pointsBehindLeader,
    recentFormPoints: form?.recent_form_points ?? 0,
    rankMovement: null, // TOUJOURS null en V1 (§3)
  };
}

// Récap de la nuit en classement hebdo : le rang affiché est celui de la
// semaine ; le mouvement de rang et les « passes devant » se calculent sur le
// général, on les retire plutôt que de les mélanger.
function withWeeklyRank(recap: HomeRecap, weekly: WeeklyLeaderboardData | null): HomeRecap {
  if (weekly?.state !== "ok" || !recap.daily?.me) return recap;
  return {
    ...recap,
    daily: {
      ...recap.daily,
      me: { ...recap.daily.me, rank: weekly.currentUserRank, rankDelta: null, passed: [] },
    },
  };
}

// ============================================================================
// « À faire » : éléments comptés par la pastille de l'onglet Jouer
// (getCompetitionNavBadges). Plus affichés sur l'Actualité depuis le
// 13/11/2026 : Jouer porte déjà ces actions.
// ============================================================================

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
    matchup: null,
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

  const hiddenSeries = await hiddenSeriesFilter(supabase);
  const { data: matches } = await supabase
    .from("matches")
    .select("id, scheduled_at, game_number, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .not("series_id", "in", hiddenSeries) // Match du jour : jours non publiés masqués
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
  const matchup = await describeUpcomingMatch(nextMatch);

  return {
    kind: "matches",
    title: `${pending.length} match${pending.length > 1 ? "s" : ""} à pronostiquer`,
    subtitle: null,
    matchup,
    deadline: nextMatch.scheduled_at as string,
    count: pending.length,
    href: "/play",
  };
}

async function describeUpcomingMatch(
  match: { home_team_id: string | null; away_team_id: string | null; game_number: number }
): Promise<TodoItem["matchup"]> {
  const teamIds = [match.home_team_id, match.away_team_id].filter(
    (id): id is string => id !== null
  );
  if (teamIds.length !== 2) return null;

  const teams = await getAllTeams();

  const teamOf = (id: string): TodoMatchupTeam => {
    const team = teams.find((row) => row.id === id);
    return { abbreviation: team?.abbreviation ?? "?", name: team?.name ?? "?" };
  };

  return {
    home: teamOf(match.home_team_id as string),
    away: teamOf(match.away_team_id as string),
    gameNumber: match.game_number,
  };
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

  // public.bet_deadline_open() (T3 §2), via lib/scoring/bet-deadline.ts (B3) :
  // MATCH → coup d'envoi du match visé ; SÉRIE → coup d'envoi du 1er match.
  const deadlines = await computeBetDeadlines(
    supabase,
    bets.map((bet) => ({
      id: bet.id,
      scope: bet.scope as "MATCH" | "SERIES",
      seriesId: bet.series_id as string,
      matchId: bet.match_id as string | null,
    }))
  );
  const nowMs = Date.now();
  const openBets = bets.flatMap((bet) => {
    const deadline = deadlines.get(bet.id) ?? null;
    if (!deadline || Date.parse(deadline) <= nowMs) return [];
    return [{ deadline, status: bet.status as string }];
  });

  if (openBets.length === 0) return null;

  const nearestDeadline = openBets.reduce(
    (min, bet) => (bet.deadline < min ? bet.deadline : min),
    openBets[0].deadline
  );

  // Un DRAFT se modifie sur /play (Mes pronos, InlineBetForm) : sans
  // ambiguïté malgré la fusion des écrans (18/08/2026,
  // SPEC_REFONTE_ONGLET_JOUER_V0_1 §2.1) — un DRAFT/SUBMITTED ne peut exister
  // que tant que bet_deadline_open() est vraie, donc son match est TOUJOURS
  // dans la fenêtre Mes pronos, jamais dans Résultats. S'il ne reste QUE des
  // REJECTED, il n'y a rien à éditer là-bas — direct vers Nouveau pari plutôt
  // que de faire chercher le joueur (trouvé en confirmant avec l'utilisateur
  // que l'Accueil et l'ex-écran Mes paris divergeaient ici, avant le 18/08).
  const hasDraft = openBets.some((bet) => bet.status === "DRAFT");

  return {
    kind: "bets",
    title: `${openBets.length} pari${openBets.length > 1 ? "s" : ""} à finaliser`,
    matchup: null,
    subtitle: hasDraft
      ? "Brouillons ou paris à reproposer avant leur deadline."
      : `Pari${openBets.length > 1 ? "s" : ""} refusé${openBets.length > 1 ? "s" : ""}, encore reproposable${openBets.length > 1 ? "s" : ""} avant leur deadline.`,
    deadline: nearestDeadline,
    count: openBets.length,
    href: hasDraft ? "/play" : "/play/bets/new",
  };
}

// ============================================================================
// « Ça vient de tomber » (§6)
// ============================================================================

type MatchScoreRow = {
  id: string;
  game_number: number;
  scheduled_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

/** Paris tranchés d'une nuit (carte « Ta nuit » de l'Actualité, 13/11/2026) :
 *  MÊMES règles que le récap (lib/recaps/load.ts) — pronos des matchs
 *  programmés dans la fenêtre (leur scored_at est réécrit à chaque recalcul,
 *  il ne dit pas de quelle nuit ils sont), paris par scored_at dans la
 *  fenêtre. Avant, la liste prenait les 48 dernières heures et mélangeait
 *  deux nuits sous le titre « Résultats de la nuit ». */
export type NightWindow = { startIso: string; endIso: string };

const NIGHT_MAX_ITEMS = 50;

async function nightMatchIds(supabase: SupabaseServerClient, competitionId: string, window: NightWindow): Promise<string[]> {
  const { data } = await supabase
    .from("matches")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("status", "FINISHED")
    .gte("scheduled_at", window.startIso)
    .lt("scheduled_at", window.endIso);
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export async function getFeed(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string,
  options: { since?: string; maxItems?: number; night?: NightWindow } = {}
): Promise<FeedItem[]> {
  const night = options.night;
  const since = night?.startIso ?? options.since ?? new Date(Date.now() - FEED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const until = night?.endIso ?? null;
  const maxItems = options.maxItems ?? (night ? NIGHT_MAX_ITEMS : FEED_MAX_ITEMS);
  const nightMatches = night ? await nightMatchIds(supabase, competitionId, night) : null;

  const predictionsQuery = supabase
    .from("match_predictions")
    .select("match_id, points_awarded, is_winner_correct, margin_diff, scored_at")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .not("scored_at", "is", null);
  const scoredBetsQuery = supabase
    .from("bets")
    .select("id, description, points_awarded, status, scored_at, scope, match_id, series_id")
    .eq("competition_id", competitionId)
    .eq("user_id", userId)
    .in("status", ["WON", "LOST"])
    .not("scored_at", "is", null)
    .gte("scored_at", since);

  const [{ data: scoredPredictions }, { data: scoredBets }, { data: resolvedBets }] =
    await Promise.all([
      nightMatches === null
        ? predictionsQuery.gte("scored_at", since)
        : nightMatches.length > 0
          ? predictionsQuery.neq("status", "DRAFT").in("match_id", nightMatches)
          : Promise.resolve({ data: [] as { match_id: string; points_awarded: number | null; is_winner_correct: boolean | null; margin_diff: number | null; scored_at: string }[] }),
      until ? scoredBetsQuery.lt("scored_at", until) : scoredBetsQuery,
      // « Pari statué par l'admin » = pari ANNULÉ/neutralisé (resolved_at) —
      // WON/LOST sont déjà couverts ci-dessus comme résultat (§6, décision
      // de session : lecture littérale de la colonne resolved_at + cohérence
      // avec la règle « neutralisé, jamais rouge » de 0.2.4/0.2.9/T6c).
      supabase
        .from("bets")
        .select("id, description, points_awarded, resolution_reason, resolved_at, scope, match_id, series_id")
        .eq("competition_id", competitionId)
        .eq("user_id", userId)
        .eq("status", "CANCELLED")
        .not("resolved_at", "is", null)
        .gte("resolved_at", since)
        .lt("resolved_at", until ?? "9999-12-31T00:00:00.000Z"),
    ]);

  // Lien d'un match/pari MATCH vers Résultats (18/08/2026) : `?date=` en plus
  // de l'ancre, sinon on atterrit bien sur la bonne LIGNE mais le bandeau de
  // dates reste sur "Tous" au lieu de cocher le jour concerné (repéré par
  // l'utilisateur en testant l'ancre seule). Une cible résolue est toujours
  // FINISHED, jamais dans Mes pronos (§14 SPEC_REFONTE_ONGLET_JOUER) — le
  // filtre `?date=` y renvoie donc toujours un résultat, jamais une page vide.
  function matchHref(matchId: string, scheduledAt: string | null): string {
    const date = scheduledAt ? `?date=${parisDateKey(Date.parse(scheduledAt))}` : "";
    return `/play/results${date}#match-${matchId}`;
  }
  // SERIES -> Bracket, même ancre/patron que getSeriesBetsTodo plus haut.
  function betHref(bet: { scope: "MATCH" | "SERIES"; match_id: string | null; series_id: string }): string | null {
    if (bet.scope === "MATCH") return bet.match_id ? matchHref(bet.match_id, matchById.get(bet.match_id)?.scheduled_at ?? null) : null;
    return `/bracket#series-${bet.series_id}`;
  }

  // Tous les matchs dont on a besoin de la date : ceux des pronos scorés ET
  // ceux des paris MATCH (2 sources distinctes, potentiellement disjointes).
  const matchIds = [
    ...new Set([
      ...(scoredPredictions ?? []).map((p) => p.match_id as string),
      ...(scoredBets ?? []).filter((b) => b.scope === "MATCH" && b.match_id).map((b) => b.match_id as string),
      ...(resolvedBets ?? []).filter((b) => b.scope === "MATCH" && b.match_id).map((b) => b.match_id as string),
    ]),
  ];
  const { data: matches } =
    matchIds.length > 0
      ? await supabase
          .from("matches")
          .select("id, game_number, scheduled_at, home_team_id, away_team_id, home_score, away_score")
          .in("id", matchIds)
      : { data: [] as MatchScoreRow[] };

  const teamIds = [
    ...new Set(
      (matches ?? [])
        .flatMap((match) => [match.home_team_id, match.away_team_id])
        .filter((id): id is string => id !== null)
    ),
  ];
  const teams = teamIds.length > 0 ? await getAllTeams() : [];

  const teamAbbrev = (id: string | null) =>
    id ? teams.find((team) => team.id === id)?.abbreviation ?? "?" : "?";
  const matchById = new Map((matches ?? []).map((match) => [match.id, match as MatchScoreRow]));

  const matchItems: FeedItem[] = (scoredPredictions ?? []).map((prediction) => {
    const match = matchById.get(prediction.match_id as string);
    const label = match
      ? `Game ${match.game_number} · ${teamAbbrev(match.home_team_id)} ${match.home_score ?? "-"} - ${match.away_score ?? "-"} ${teamAbbrev(match.away_team_id)}`
      : "Match scoré";
    const detail = prediction.margin_diff === 0 ? "Écart exact" : prediction.is_winner_correct ? "Bon vainqueur" : "Mauvais vainqueur";
    return {
      kind: "match_scored",
      label,
      detail,
      points: prediction.points_awarded,
      outcome: prediction.is_winner_correct ? "win" : "loss",
      occurredAt: prediction.scored_at as string,
      href: matchHref(prediction.match_id as string, match?.scheduled_at ?? null),
    };
  });

  const betScoredItems: FeedItem[] = (scoredBets ?? []).map((bet) => ({
    kind: "bet_scored",
    label: bet.description as string,
    detail: null,
    points: bet.points_awarded,
    outcome: bet.status === "WON" ? "win" : "loss",
    occurredAt: bet.scored_at as string,
    href: betHref(bet),
  }));

  const betResolvedItems: FeedItem[] = (resolvedBets ?? []).map((bet) => ({
    kind: "bet_resolved",
    label: bet.description as string,
    detail: bet.resolution_reason ? `Neutralisé : ${bet.resolution_reason}` : "Neutralisé",
    points: bet.points_awarded,
    outcome: "neutral",
    occurredAt: bet.resolved_at as string,
    href: betHref(bet),
  }));

  return [...matchItems, ...betScoredItems, ...betResolvedItems]
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, maxItems);
}

/** Résultats du joueur (pronos scorés, paris corrigés ou neutralisés) tombés
 *  depuis `since`, pour la popup « depuis ta dernière visite »
 *  (components/recap/ActivityRecapWatcher.tsx). Même source que « Ça vient de
 *  tomber », sans la fenêtre de 48 h ni le plafond de 5. */
export async function getResultsSince(since: string, maxItems: number): Promise<FeedItem[]> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const competition = await getActiveCompetition(supabase);
  if (!competition) return [];

  return getFeed(supabase, competition.id, user.id, { since, maxItems });
}

// ============================================================================
// Pastilles de la TabBar (components/nav/TabBar.tsx) — lues par app/(app)/
// layout.tsx, donc pas rafraîchies à chaque navigation cliente (seulement à
// l'entrée dans la zone (app) et après une action serveur qui revalide "/home"
// ou "/play", déjà en place dans lib/actions/bets.ts etc.). Réutilise les
// mêmes helpers que getHomeData() plutôt que de dupliquer leur logique ;
// getFeed() est déjà trié décroissant, donc feed[0] EST le plus récent.
// ============================================================================

export type NavBadgeData = {
  /** Somme des actions en attente accessibles depuis l'onglet Jouer (bracket
   *  + matchs à pronostiquer + paris à finaliser + paris disponibles). */
  playPendingCount: number;
  /** Date du plus récent item de « Ça vient de tomber », pour que la TabBar
   *  (client) la compare au repère « vu » du compte (seenState,
   *  lib/seen/store.ts). */
  latestFeedAt: string | null;
  /** Messages récents des autres joueurs (p3-7), comptés comme non lus par la
   *  TabBar selon le repère « lu » du compte (chatReadStatus, lib/nav/chatSeen.ts).
   *  Indépendant de la compétition : le chat vit aussi sans compétition active. */
  chatActivity: ChatActivity[];
  /** Repère « lu » par canal, stocké en base (chat_read_status). */
  chatReadStatus: ChatReadStatus;
  /** Repères « vu / fermé » du compte (pastille Accueil, cartes), user_seen_state. */
  seenState: Record<string, string>;
  /** Menu Réglages de la TabBar : l'entrée « Admin » n'apparaît que pour un admin. */
  isAdmin: boolean;
};

async function getIsAdmin(): Promise<boolean> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle<{ role: string }>();
  return data?.role === "ADMIN";
}

export async function getNavBadgeData(): Promise<NavBadgeData> {
  const [competitionBadges, chatActivity, chatReadStatus, seenState, isAdmin] = await Promise.all([
    getCompetitionNavBadges(),
    getRecentChatActivity(),
    getChatReadStatus(),
    getUserSeenState(),
    getIsAdmin(),
  ]);
  return { ...competitionBadges, chatActivity, chatReadStatus, seenState, isAdmin };
}

const EMPTY_COMPETITION_NAV_BADGES = { playPendingCount: 0, latestFeedAt: null };

async function getCompetitionNavBadges(): Promise<Omit<NavBadgeData, "chatActivity" | "chatReadStatus" | "seenState" | "isAdmin">> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY_COMPETITION_NAV_BADGES;

  const competition = await getActiveCompetition(supabase);

  if (!competition) return EMPTY_COMPETITION_NAV_BADGES;

  const [bracketItem, matchesItem, betsItem, seriesBets, matchBets, feed] = await Promise.all([
    getBracketTodo(supabase, competition, user.id),
    getMatchesTodo(supabase, competition.id, user.id),
    getBetsTodo(supabase, competition.id, user.id),
    getRemainingSeriesBets({ supabase, userId: user.id, competition }),
    getRemainingMatchBets({ supabase, userId: user.id, competition }),
    getFeed(supabase, competition.id, user.id),
  ]);

  // Match du jour (7 matchs visibles d'un coup) : on ne compte que les pronos,
  // pas les paris joueur encore possibles (décision du 07/10/2026 : le badge
  // ne doit pas faire monter la pression, jusqu'à 14 d'un coup sinon).
  const availableBets = competition.type === "DAILY_MATCH" ? 0 : seriesBets.length + matchBets.length;
  const playPendingCount =
    (bracketItem?.count ?? 0) + (matchesItem?.count ?? 0) + (betsItem?.count ?? 0) + availableBets;

  return { playPendingCount, latestFeedAt: feed[0]?.occurredAt ?? null };
}
