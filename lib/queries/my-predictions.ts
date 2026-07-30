import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { parisDayBoundsUtc } from "@/lib/dates/paris";
import type { TeamRef } from "@/lib/queries/matches";
import { toAdminCorrection, type AdminCorrection } from "@/lib/queries/adminCorrection";
import { resolveLeagueScope } from "@/lib/queries/leagues";

// Lecture de l'écran "Mes pronos" (composants serveur uniquement),
// SPEC_ECRAN_MES_PRONOS_V0_1 §13. Un seul module, appelé avec
// getServerClient() (jamais service_role) : la RLS reste seule autorité de
// visibilité — mais ici sans branche de confidentialité à coder (§12) : cet
// écran ne liste QUE des matchs verrouillés, la RLS révèle déjà les pronos de
// tous sur ces matchs.
//
// ANCRAGE SUR LES MATCHS, PAS SUR LES PRONOS (§3, contrainte transmise) :
// tout match verrouillé apparaît, même sans aucune ligne match_predictions.
//
// RAPPEL CRITIQUE (§10.4) : ne jamais tester la PRÉSENCE d'une ligne
// match_predictions, TOUJOURS sa COMPLÉTUDE. Une ligne vide (voie A, §10.2)
// est un état légitime qui se rend en MISSING, jamais en INCOMPLETE.

// Réutilisé tel quel depuis lib/queries/matches.ts — contrat figé par
// SPEC_ECRAN_MATCHS_V0_1 §13 (§18.1 de cette spec : sa forme réelle convient,
// vérifié en ÉTAPE 0 du 24/07/2026 ; ne pas redéfinir, ne pas modifier).
export type { TeamRef };

export type MyPredictionsMode = "RECENT" | "HISTORY" | "FILTERED";

/** État live du match, tel qu'on peut l'affirmer — cf. §5.4. */
export type MatchLiveState =
  | "STARTED" // heure passée, mais la base dit encore SCHEDULED (latence synchro)
  | "LIVE" // IN_PROGRESS
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

/** Les trois états du §8. Une ligne VIDE se rend en MISSING, jamais INCOMPLETE. */
export type MyPredictionState = "FROZEN" | "INCOMPLETE" | "MISSING";

// AdminCorrection/toAdminCorrection : voir lib/queries/adminCorrection.ts
// (partagé avec lib/queries/matches.ts). Le requérant est toujours le
// propriétaire du prono (§7.1) : il n'est donc pas porté par ce type, il est
// déjà connu de la ligne qui affiche ce bloc.

export type MyPrediction = {
  state: MyPredictionState;
  predictedWinner: TeamRef | null;
  predictedMargin: number | null;
  isAutoValidated: boolean;
  /** null = pas corrigé par un admin. */
  adminCorrection: AdminCorrection | null;
  /** null = pas encore scoré → rendu « — », jamais « 0 » (§9). */
  points: number | null;
};

/** Prono d'un AUTRE joueur, révélé dans le panneau déplié (§7).
 *  NE réutilise PAS OtherPrediction de matches.ts : ce type-là ne porte qu'un
 *  booléen isAdminCorrected, ce qui viderait 0.2.3 §7 de sa substance (§7.1). */
export type RevealedPrediction = {
  userId: string;
  userName: string;
  predictedWinner: TeamRef | null;
  predictedMargin: number | null;
  adminCorrection: AdminCorrection | null;
  points: number | null;
};

export type CorrectionRequestState = {
  status: "PENDING" | "PROCESSED" | "REJECTED";
  /** Obligatoire si REJECTED (0.2.7 §6). */
  adminReason: string | null;
  createdAt: string;
};

export type AssociatedBet = {
  id: string;
  description: string;
  category: string;
  /** validated_difficulty ?? proposed_difficulty — la validée fait foi. */
  difficulty: number;
  isDifficultyValidated: boolean;
  status: "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";
  points: number | null;
};

/** Pari PUBLIC d'un AUTRE joueur (0.2.4 §9 — révélé à sa propre deadline, RLS
 *  bet_is_public()). AUCUN champ de statut/points/difficulté ici : la spec ne
 *  demande que le nom du joueur et l'énoncé, pas un mini AssociatedBetCard. */
export type OtherBet = {
  userId: string;
  userName: string;
  description: string;
};

export type MyPredictionRow = {
  matchId: string;
  seriesId: string;
  gameNumber: number;
  /** ISO. Jamais null : les matchs sans heure sont exclus (§3). */
  scheduledAt: string;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  liveState: MatchLiveState;
  prediction: MyPrediction;
  correctionRequest: CorrectionRequestState | null;
  /** Pari MATCH uniquement. Les paris SERIES vivent dans seriesBet (§11.2). */
  bet: AssociatedBet | null;
  /** Toujours chargés côté serveur : tout est révélé sur un match verrouillé
   *  (§12). Le repli est purement visuel (<details>). */
  others: RevealedPrediction[];
  absenteeCount: number;
  /** Paris MATCH publics des AUTRES joueurs sur CE match (0.2.4 §9). RLS
   *  bet_is_public() a déjà filtré — jamais re-filtré ici (C-6). */
  otherBets: OtherBet[];
};

export type SeriesBetHeader = {
  seriesId: string;
  /** Construit avec lib/labels/rounds.ts, jamais en dur (§16.5). */
  seriesLabel: string;
  bet: AssociatedBet | null;
  /** Paris SERIES publics des AUTRES joueurs sur CETTE série (0.2.4 §9). */
  otherBets: OtherBet[];
};

export type MyPredictionsData = {
  mode: MyPredictionsMode;
  filter: { date: string | null; seriesId: string | null };
  /** Non null UNIQUEMENT en mode FILTERED sur une série (§11.2). */
  seriesBet: SeriesBetHeader | null;
  /** Déjà triées : EN DIRECT en tête, puis anti-chronologique (§5.2). */
  rows: MyPredictionRow[];
  /** Pagination de l'historique (§4.4). */
  hasMore: boolean;
  /** Valeurs proposables par les filtres — jamais inventées au rendu (§4.2). */
  availableDates: string[];
  availableSeries: { id: string; label: string }[];
  /** Filtre "des autres joueurs" par ligue (30/07/2026, demandé par
   *  l'utilisateur) — null = Général (tout le monde), même repli
   *  silencieux qu'ailleurs (id invalide/pas membre -> Général). Filtre
   *  UNIQUEMENT others/absenteeCount/otherBets, jamais mon propre prono. */
  scopeLeagueId: string | null;
  scopeLeagueName: string | null;
};

const RECENT_WINDOW_DAYS = 3;
const DEFAULT_LIMIT = 40;
// Même fuseau que l'écran Matchs (§16.3) — aucune convention de fuseau
// n'existe ailleurs que Europe/Paris, choisi explicitement (le fuseau machine
// du serveur peut être UTC en hébergement).
const DAY_TIMEZONE = "Europe/Paris";

type CompetitionRow = { id: string };

type MatchRow = {
  id: string;
  series_id: string;
  game_number: number;
  scheduled_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
  home_score: number | null;
  away_score: number | null;
};

type TeamRow = { id: string; name: string; abbreviation: string };

type PredictionRow = {
  id: string;
  user_id: string;
  match_id: string;
  predicted_winner_team_id: string | null;
  predicted_margin: number | null;
  is_auto_validated: boolean;
  corrected_by_admin_id: string | null;
  correction_reason: string | null;
  points_awarded: number | null;
  scored_at: string | null;
};

type CorrectionRequestRow = {
  target_match_prediction_id: string;
  status: "PENDING" | "PROCESSED" | "REJECTED";
  admin_reason: string | null;
  created_at: string;
};

type BetRow = {
  id: string;
  user_id: string;
  match_id: string | null;
  series_id: string;
  description: string;
  proposed_category: string;
  validated_category: string | null;
  proposed_difficulty: number;
  validated_difficulty: number | null;
  status: AssociatedBet["status"];
  points_awarded: number | null;
  scored_at: string | null;
};

type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };

type ActiveUserRow = { id: string; pseudo: string };

export async function getMyPredictions(params: {
  mode: MyPredictionsMode;
  date?: string;
  seriesId?: string;
  limit?: number; // défaut 40 (§4.4)
  leagueId?: string | null;
}): Promise<MyPredictionsData | null> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Ne devrait pas se produire : le layout (app) garde déjà la session.
    return null;
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    return null;
  }

  const scope = await resolveLeagueScope(supabase, params.leagueId);
  const scopeLeagueId = scope?.id ?? null;
  const scopeLeagueName = scope?.name ?? null;

  const limit = params.limit ?? DEFAULT_LIMIT;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Sélection ancrée sur les MATCHS, jamais sur matches.status (§2/§3) — un
  // match verrouillé apparaît même sans aucun prono.
  let query = supabase
    .from("matches")
    .select("id, series_id, game_number, scheduled_at, home_team_id, away_team_id, status, home_score, away_score")
    .eq("competition_id", competition.id)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: false });

  if (params.mode === "RECENT") {
    const windowStartIso = new Date(nowMs - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("scheduled_at", windowStartIso);
  } else if (params.mode === "FILTERED") {
    if (params.date) {
      const { startIso, endIsoExclusive } = parisDayBoundsUtc(params.date);
      query = query.gte("scheduled_at", startIso).lt("scheduled_at", endIsoExclusive);
    }
    if (params.seriesId) {
      query = query.eq("series_id", params.seriesId);
    }
  }
  // HISTORY : aucune restriction supplémentaire — tous les matchs verrouillés
  // de la compétition, plafonnés par limit (§4.4).

  // limit+1 pour détecter hasMore sans requête de comptage séparée.
  const { data: pageData } = await query.limit(limit + 1);
  const page = (pageData ?? []) as MatchRow[];
  const hasMore = page.length > limit;
  const matches = hasMore ? page.slice(0, limit) : page;

  // Filtres proposables (§4.2) : dérivés de TOUS les matchs verrouillés de la
  // compétition, indépendamment de la fenêtre/pagination courante — jamais une
  // liste inventée au rendu.
  const { availableDates, availableSeries, seriesById } = await getAvailableFilters(supabase, competition.id);

  if (matches.length === 0) {
    const seriesBet =
      params.mode === "FILTERED" && params.seriesId
        ? await getSeriesBetHeader(supabase, competition.id, user.id, params.seriesId, seriesById, scope?.memberUserIds ?? null)
        : null;
    return {
      mode: params.mode,
      filter: { date: params.date ?? null, seriesId: params.seriesId ?? null },
      seriesBet,
      rows: [],
      hasMore: false,
      availableDates,
      availableSeries,
      scopeLeagueId,
      scopeLeagueName,
    };
  }

  const matchIds = matches.map((m) => m.id);

  const [{ data: teamsData }, { data: predictionsData }, { data: betsData }, { data: activeUsersData }] =
    await Promise.all([
      supabase.from("teams").select("id, name, abbreviation"),
      supabase
        .from("match_predictions")
        .select(
          "id, user_id, match_id, predicted_winner_team_id, predicted_margin, is_auto_validated, corrected_by_admin_id, correction_reason, points_awarded, scored_at"
        )
        .in("match_id", matchIds),
      // PAS de filtre user_id (contrairement à avant, §9 révélation
      // publique) : RLS bet_is_public() renvoie déjà mon pari + les paris
      // PUBLICS des autres, jamais un pari privé d'un autre (C-6, jamais
      // re-filtré ici).
      supabase
        .from("bets")
        .select(
          "id, user_id, match_id, series_id, description, proposed_category, validated_category, proposed_difficulty, validated_difficulty, status, points_awarded, scored_at"
        )
        .eq("competition_id", competition.id)
        .eq("scope", "MATCH")
        .in("match_id", matchIds),
      supabase.from("users").select("id, pseudo").eq("status", "ACTIVE"),
    ]);

  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, teamRef(t)]));
  const predictions = (predictionsData ?? []) as PredictionRow[];
  const bets = (betsData ?? []) as BetRow[];
  // Portée ligue (30/07/2026) : le pool "absents" se restreint aux membres de
  // la ligue choisie, exactement comme others/otherBets plus bas — mon propre
  // prono/pari, lui, n'est JAMAIS filtré (§ commentaire de tête du type).
  const activeUsers = ((activeUsersData ?? []) as ActiveUserRow[]).filter(
    (u) => !scope || scope.memberUserIds.has(u.id)
  );

  // Pseudos nécessaires : auteurs des pronos des AUTRES joueurs (complets,
  // §7.1 amendement) + admins ayant corrigé un prono (le mien ou celui d'un
  // autre) — un seul aller-retour pour les deux.
  const otherAuthorIds = new Set(
    predictions.filter((p) => p.user_id !== user.id && isComplete(p)).map((p) => p.user_id)
  );
  const adminIds = new Set(predictions.filter((p) => p.corrected_by_admin_id).map((p) => p.corrected_by_admin_id!));
  // Auteurs des paris MATCH publics des autres joueurs (§9) — même lot de
  // pseudos que les pronos, un seul aller-retour pour tout.
  const otherBetAuthorIds = new Set(bets.filter((b) => b.user_id !== user.id).map((b) => b.user_id));
  const pseudoNeededIds = [...new Set([...otherAuthorIds, ...adminIds, ...otherBetAuthorIds])];
  const { data: profilesData } =
    pseudoNeededIds.length > 0
      ? await supabase.from("users").select("id, pseudo").in("id", pseudoNeededIds)
      : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((profilesData ?? []).map((row) => [row.id as string, row.pseudo as string]));

  // Ma requête de correction : cherchée UNIQUEMENT parmi mes propres lignes de
  // prono sur ces matchs (jamais par présence, §10.4 — la ligne de la voie A
  // existe déjà si une requête a été déposée sur un match MISSING).
  const ownPredictionIds = predictions.filter((p) => p.user_id === user.id).map((p) => p.id);
  const { data: correctionRequestsData } =
    ownPredictionIds.length > 0
      ? await supabase
          .from("correction_requests")
          .select("target_match_prediction_id, status, admin_reason, created_at")
          .in("target_match_prediction_id", ownPredictionIds)
          .order("created_at", { ascending: false })
      : { data: [] as CorrectionRequestRow[] };
  // Le plus récent par prono (trié desc plus haut, on ne garde que le 1er par clé).
  const correctionRequestByPredictionId = new Map<string, CorrectionRequestRow>();
  for (const row of (correctionRequestsData ?? []) as CorrectionRequestRow[]) {
    if (!correctionRequestByPredictionId.has(row.target_match_prediction_id)) {
      correctionRequestByPredictionId.set(row.target_match_prediction_id, row);
    }
  }

  const predictionsByMatch = new Map<string, PredictionRow[]>();
  for (const p of predictions) {
    const list = predictionsByMatch.get(p.match_id) ?? [];
    list.push(p);
    predictionsByMatch.set(p.match_id, list);
  }
  const betByMatch = new Map(bets.filter((b) => b.user_id === user.id).map((b) => [b.match_id as string, b]));

  const otherBetsByMatch = new Map<string, OtherBet[]>();
  for (const b of bets) {
    if (b.user_id === user.id || !b.match_id) continue;
    if (scope && !scope.memberUserIds.has(b.user_id)) continue;
    const list = otherBetsByMatch.get(b.match_id) ?? [];
    list.push({ userId: b.user_id, userName: pseudoById.get(b.user_id) ?? "", description: b.description });
    otherBetsByMatch.set(b.match_id, list);
  }
  for (const list of otherBetsByMatch.values()) list.sort((a, b) => a.userName.localeCompare(b.userName));

  const rows: MyPredictionRow[] = [];
  for (const match of matches) {
    const homeTeam = match.home_team_id ? teams.get(match.home_team_id) : undefined;
    const awayTeam = match.away_team_id ? teams.get(match.away_team_id) : undefined;
    if (!homeTeam || !awayTeam) continue; // garde défensive, ne devrait pas arriver (FK not null en pratique)

    const matchPredictions = predictionsByMatch.get(match.id) ?? [];
    const own = matchPredictions.find((p) => p.user_id === user.id);

    const others: RevealedPrediction[] = matchPredictions
      .filter((p) => p.user_id !== user.id && isComplete(p))
      .filter((p) => !scope || scope.memberUserIds.has(p.user_id))
      .map((p) => toRevealedPrediction(p, teams, pseudoById))
      .sort((a, b) => a.userName.localeCompare(b.userName));

    const committedUserIds = new Set(matchPredictions.filter(isComplete).map((p) => p.user_id));
    const absenteeCount = activeUsers.filter((u) => !committedUserIds.has(u.id)).length;

    const correctionRequestRow = own ? correctionRequestByPredictionId.get(own.id) : undefined;

    rows.push({
      matchId: match.id,
      seriesId: match.series_id,
      gameNumber: match.game_number,
      scheduledAt: match.scheduled_at,
      home: homeTeam,
      away: awayTeam,
      homeScore: match.home_score,
      awayScore: match.away_score,
      liveState: toLiveState(match.status),
      prediction: toMyPrediction(own, teams, pseudoById),
      correctionRequest: correctionRequestRow
        ? {
            status: correctionRequestRow.status,
            adminReason: correctionRequestRow.admin_reason,
            createdAt: correctionRequestRow.created_at,
          }
        : null,
      bet: betByMatch.has(match.id) ? toAssociatedBet(betByMatch.get(match.id)!) : null,
      others,
      absenteeCount,
      otherBets: otherBetsByMatch.get(match.id) ?? [],
    });
  }

  // §5.2 : EN DIRECT en tête, puis anti-chronologique. `matches` est déjà trié
  // anti-chronologiquement (requête) ; on ne fait que faire remonter les LIVE,
  // en préservant l'ordre relatif au sein de chaque groupe (tri stable).
  rows.sort((a, b) => Number(b.liveState === "LIVE") - Number(a.liveState === "LIVE"));

  const seriesBet =
    params.mode === "FILTERED" && params.seriesId
      ? await getSeriesBetHeader(supabase, competition.id, user.id, params.seriesId, seriesById, scope?.memberUserIds ?? null)
      : null;

  return {
    mode: params.mode,
    filter: { date: params.date ?? null, seriesId: params.seriesId ?? null },
    seriesBet,
    rows,
    hasMore,
    availableDates,
    availableSeries,
    scopeLeagueId,
    scopeLeagueName,
  };
}

function teamRef(row: TeamRow): TeamRef {
  return { id: row.id, abbreviation: row.abbreviation, name: row.name };
}

/** Complétude d'un prono (§10.4) — jamais sa présence, jamais son statut brut.
 *  Une ligne DRAFT aux deux champs remplis (sealDeadlines jamais invoqué dans
 *  ce code, aucun job ne promeut jamais un brouillon complet en VALIDATED)
 *  compte comme complète — décision actée avec l'utilisateur le 24/07/2026,
 *  ÉTAPE 3 : la complétude prime sur le statut brut, symétriquement pour MON
 *  prono et pour ceux des AUTRES joueurs. */
function isComplete(p: PredictionRow): boolean {
  return p.predicted_winner_team_id !== null && p.predicted_margin !== null;
}

function toLiveState(status: MatchRow["status"]): MatchLiveState {
  switch (status) {
    case "IN_PROGRESS":
      return "LIVE";
    case "FINISHED":
      return "FINISHED";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    case "SCHEDULED":
      // Le match est verrouillé (scheduled_at <= now(), garanti par la
      // sélection) mais le planificateur (30-60 min, T4, non codé) n'est pas
      // encore passé dessus — latence assumée (§5.4).
      return "STARTED";
  }
}

function toMyPrediction(
  own: PredictionRow | undefined,
  teams: Map<string, TeamRef>,
  pseudoById: Map<string, string>
): MyPrediction {
  if (!own) {
    return {
      state: "MISSING",
      predictedWinner: null,
      predictedMargin: null,
      isAutoValidated: false,
      adminCorrection: null,
      points: null,
    };
  }
  const complete = isComplete(own);
  const state: MyPredictionState = complete
    ? "FROZEN"
    : own.predicted_winner_team_id === null && own.predicted_margin === null
      ? "MISSING" // ligne vide laissée par la voie A (§10.2) — jamais INCOMPLETE
      : "INCOMPLETE";
  return {
    state,
    predictedWinner: own.predicted_winner_team_id ? (teams.get(own.predicted_winner_team_id) ?? null) : null,
    predictedMargin: own.predicted_margin,
    isAutoValidated: own.is_auto_validated,
    adminCorrection: toAdminCorrection(own.corrected_by_admin_id, own.correction_reason, pseudoById),
    points: own.scored_at === null ? null : own.points_awarded,
  };
}

function toRevealedPrediction(
  p: PredictionRow,
  teams: Map<string, TeamRef>,
  pseudoById: Map<string, string>
): RevealedPrediction {
  return {
    userId: p.user_id,
    userName: pseudoById.get(p.user_id) ?? "",
    predictedWinner: p.predicted_winner_team_id ? (teams.get(p.predicted_winner_team_id) ?? null) : null,
    predictedMargin: p.predicted_margin,
    adminCorrection: toAdminCorrection(p.corrected_by_admin_id, p.correction_reason, pseudoById),
    points: p.scored_at === null ? null : p.points_awarded,
  };
}

function toAssociatedBet(b: BetRow): AssociatedBet {
  return {
    id: b.id,
    description: b.description,
    category: b.validated_category ?? b.proposed_category,
    difficulty: b.validated_difficulty ?? b.proposed_difficulty,
    isDifficultyValidated: b.validated_difficulty !== null,
    status: b.status,
    points: b.scored_at === null ? null : b.points_awarded,
  };
}

function seriesLabel(series: SeriesRow | undefined, teams: Map<string, TeamRef>): string {
  if (!series) return "";
  const round = ROUND_LABELS[series.round] ?? series.round;
  const team1 = series.team1_id ? teams.get(series.team1_id)?.abbreviation : undefined;
  const team2 = series.team2_id ? teams.get(series.team2_id)?.abbreviation : undefined;
  return team1 && team2 ? `${round} — ${team1} vs ${team2}` : round;
}

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

/** Valeurs proposables par les filtres date/série (§4.2) — dérivées de TOUS
 *  les matchs verrouillés de la compétition, jamais inventées au rendu. */
async function getAvailableFilters(
  supabase: SupabaseServerClient,
  competitionId: string
): Promise<{
  availableDates: string[];
  availableSeries: { id: string; label: string }[];
  seriesById: Map<string, SeriesRow>;
}> {
  const nowIso = new Date().toISOString();
  const { data: lockedData } = await supabase
    .from("matches")
    .select("series_id, scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", nowIso);

  const locked = (lockedData ?? []) as { series_id: string; scheduled_at: string }[];
  if (locked.length === 0) {
    return { availableDates: [], availableSeries: [], seriesById: new Map() };
  }

  const dateKeys = new Set<string>();
  const latestMsBySeries = new Map<string, number>();
  for (const row of locked) {
    const ms = Date.parse(row.scheduled_at);
    dateKeys.add(localDateKey(ms));
    const current = latestMsBySeries.get(row.series_id);
    if (current === undefined || ms > current) latestMsBySeries.set(row.series_id, ms);
  }

  const availableDates = [...dateKeys].sort((a, b) => (a < b ? 1 : -1)); // plus récent d'abord

  const seriesIds = [...latestMsBySeries.keys()];
  const [{ data: seriesData }, { data: teamsData }] = await Promise.all([
    supabase.from("series").select("id, round, team1_id, team2_id").in("id", seriesIds),
    supabase.from("teams").select("id, name, abbreviation"),
  ]);
  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, teamRef(t)]));
  const seriesById = new Map(((seriesData ?? []) as SeriesRow[]).map((s) => [s.id, s]));

  const availableSeries = seriesIds
    .sort((a, b) => (latestMsBySeries.get(b) ?? 0) - (latestMsBySeries.get(a) ?? 0))
    .map((id) => ({ id, label: seriesLabel(seriesById.get(id), teams) }));

  return { availableDates, availableSeries, seriesById };
}

/** En-tête de pari SERIES (§11.2) — uniquement en mode FILTERED sur une série.
 *  §9 (révélation publique) : PAS de filtre user_id — RLS bet_is_public()
 *  renvoie mon pari + les paris publics des autres, jamais un pari privé
 *  d'un autre (C-6). */
async function getSeriesBetHeader(
  supabase: SupabaseServerClient,
  competitionId: string,
  userId: string,
  seriesId: string,
  seriesById: Map<string, SeriesRow>,
  scopeMemberUserIds: Set<string> | null
): Promise<SeriesBetHeader> {
  const { data: teamsData } = await supabase.from("teams").select("id, name, abbreviation");
  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, teamRef(t)]));

  const { data: betsData } = await supabase
    .from("bets")
    .select(
      "id, user_id, match_id, series_id, description, proposed_category, validated_category, proposed_difficulty, validated_difficulty, status, points_awarded, scored_at"
    )
    .eq("competition_id", competitionId)
    .eq("scope", "SERIES")
    .eq("series_id", seriesId);
  const bets = (betsData ?? []) as BetRow[];

  const own = bets.find((b) => b.user_id === userId);
  const otherAuthorIds = bets.filter((b) => b.user_id !== userId).map((b) => b.user_id);
  const { data: profilesData } =
    otherAuthorIds.length > 0
      ? await supabase.from("users").select("id, pseudo").in("id", otherAuthorIds)
      : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((profilesData ?? []).map((row) => [row.id as string, row.pseudo as string]));

  const otherBets: OtherBet[] = bets
    .filter((b) => b.user_id !== userId)
    .filter((b) => !scopeMemberUserIds || scopeMemberUserIds.has(b.user_id))
    .map((b) => ({ userId: b.user_id, userName: pseudoById.get(b.user_id) ?? "", description: b.description }))
    .sort((a, b) => a.userName.localeCompare(b.userName));

  return {
    seriesId,
    seriesLabel: seriesLabel(seriesById.get(seriesId), teams),
    bet: own ? toAssociatedBet(own) : null,
    otherBets,
  };
}

function localDateKey(ms: number): string {
  // en-CA formate en YYYY-MM-DD (ordre lexicographique = ordre chronologique).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

// parisDayBoundsUtc (§16.3) a déménagé dans lib/dates/paris.ts (§0 de
// SPEC_ECRAN_ADMIN_LOGS_V0_1 — 2e utilisateur, évite une 3e implémentation
// divergente), importée en tête de fichier.
