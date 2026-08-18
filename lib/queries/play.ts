import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { parisDayBoundsUtc, parisDateKey } from "@/lib/dates/paris";
import type { TeamRef } from "@/lib/queries/matches";
import { toAdminCorrection, type AdminCorrection } from "@/lib/queries/adminCorrection";
import { resolveLeagueScope } from "@/lib/queries/leagues";
import { RELEASED_BET_STATUSES, MATCH_SLOT_CAP } from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Lecture des 2 onglets de "Jouer" (SPEC_REFONTE_ONGLET_JOUER_V0_1) — fusionne
// l'ancien lib/queries/matches.ts (matchs à venir) + lib/queries/my-predictions.ts
// (matchs verrouillés) + la partie MATCH de l'ancien lib/queries/my-bets.ts
// (quotas + rattachement du pari à SON match, décision 3 de la spec : le
// match décide toujours l'onglet, le pari garde son propre statut).
//
// TeamRef reste importé de lib/queries/matches.ts (§18.1 SPEC_ECRAN_MES_PRONOS,
// jamais redéfini) — ce fichier survit à la refonte réduit à ce seul type,
// partagé par 5 autres modules hors du périmètre de cette refonte
// (admin-results.ts, bets.ts, player-profile.ts, profile.ts, admin-missing.ts).
export type { TeamRef };

export type PredictionViewStatus = "TODO" | "INCOMPLETE" | "READY" | "VALIDATED";
export type MyPredictionState = "FROZEN" | "INCOMPLETE" | "MISSING";
export type MatchLiveState = "STARTED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

/** Prono d'un AUTRE joueur AVANT verrouillage — révélé seulement si isRevealed
 *  (§8 SPEC_ECRAN_MATCHS, reconduit tel quel). */
export type OtherPrediction = {
  userId: string;
  pseudo: string;
  teamAbbreviation: string;
  margin: number;
  adminCorrection: AdminCorrection | null;
  isInactive: boolean;
};

/** Prono d'un AUTRE joueur APRÈS verrouillage — toujours révélé (§12
 *  SPEC_ECRAN_MES_PRONOS, RLS seule autorité). Forme différente
 *  d'OtherPrediction (points en plus, pas de statut inactif dédié) : les deux
 *  types restent distincts, jamais fusionnés (raison déjà actée avant la
 *  refonte, SPEC_ECRAN_MES_PRONOS_V0_1 §7 commentaire de tête). */
export type RevealedPrediction = {
  userId: string;
  userName: string;
  predictedWinner: TeamRef | null;
  predictedMargin: number | null;
  adminCorrection: AdminCorrection | null;
  points: number | null;
};

export type BetSlotIndicator =
  | { mode: "BINARY"; hasBetOnThisMatch: boolean }
  | { mode: "SERIES_QUOTA"; hasBetOnThisMatch: boolean; usedSlots: number; totalSlots: 3 };

export type CorrectionRequestState = {
  status: "PENDING" | "PROCESSED" | "REJECTED";
  adminReason: string | null;
  createdAt: string;
};

export type MyPrediction = {
  state: MyPredictionState;
  predictedWinner: TeamRef | null;
  predictedMargin: number | null;
  isAutoValidated: boolean;
  adminCorrection: AdminCorrection | null;
  /** Somme déjà faite en base (points_awarded = winnerPoints + marginPoints).
   *  null tant que non scoré — jamais 0. */
  points: number | null;
  /** Composantes du total ci-dessus (18/08/2026, demandé par l'utilisateur —
   *  détail affiché entre parenthèses sur Résultats, PredictionSummary.tsx).
   *  Mêmes conventions que `points` : non-null seulement quand `points`
   *  l'est aussi (les 2 sont scorés ensemble, une seule passe de scoring). */
  winnerPoints: number | null;
  marginPoints: number | null;
};

/** Pari MATCH public d'un AUTRE joueur (0.2.4 §9), reconduit tel quel. */
export type OtherBet = { userId: string; userName: string; description: string };

export type BetStatusValue = "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";

/** Pari MATCH associé à une ligne — TOUS statuts confondus (décision 3 de la
 *  spec : le MATCH décide de l'onglet, le pari garde son propre statut, quel
 *  qu'il soit — un REJETÉ reste ici même si son match est encore à venir). */
export type PlayAssociatedBet = {
  betId: string;
  description: string;
  category: BetCategory;
  difficulty: BetDifficulty;
  isDifficultyValidated: boolean;
  status: BetStatusValue;
  isAdminCorrected: boolean;
  refusalReason: string | null;
  resolutionReason: string | null;
  pointsAwarded: number | null;
  /** VALIDATED + cible FINISHED jamais résolue — cas "pari oublié" (§7
   *  SPEC_ECRAN_MES_PARIS), toujours faux pour une ligne UpcomingMatchRow
   *  (son match, par construction, n'est pas encore joué). */
  isForgottenResolution: boolean;
  hasPendingCorrectionRequest: boolean;
  /** REJECTED + deadline pas encore passée. Toujours null hors de l'onglet
   *  Mes pronos : bet_deadline_open() ferme la reproposition exactement au
   *  verrouillage du match (§3.3 de la spec, vérification de dépôt §13.3). */
  reproposeHref: string | null;
};

/** Match PAS ENCORE verrouillé (scheduled_at > now()) — saisie possible. */
export type UpcomingMatchRow = {
  isLocked: false;
  matchId: string;
  seriesId: string;
  scheduledAt: string;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  myWinnerTeamId: string | null;
  myMargin: number | null;
  viewStatus: PredictionViewStatus;
  predictedCount: number;
  eligibleCount: number;
  isRevealed: boolean;
  others: OtherPrediction[];
  absentees: string[];
  betSlot: BetSlotIndicator;
  bet: PlayAssociatedBet | null;
};

export type MatchDay = { key: string; label: string; matches: UpcomingMatchRow[] };

/** Match VERROUILLÉ (scheduled_at <= now()) — lecture seule, jamais de
 *  saisie de prono ni de pari (§3.3 : la deadline des deux coïncide). */
export type LockedMatchRow = {
  isLocked: true;
  matchId: string;
  seriesId: string;
  gameNumber: number;
  scheduledAt: string;
  home: TeamRef;
  away: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
  liveState: MatchLiveState;
  prediction: MyPrediction;
  correctionRequest: CorrectionRequestState | null;
  bet: PlayAssociatedBet | null;
  others: RevealedPrediction[];
  absenteeCount: number;
  otherBets: OtherBet[];
};

export type QuotaSummary =
  | { kind: "PLAYOFFS"; seriesId: string; seriesLabel: string; seriesSlotUsed: boolean; matchSlotsUsed: number }
  | { kind: "NBA_CUP"; matchId: string; matchLabel: string; matchSlotUsed: boolean };

export type PlayUpcomingData = {
  competitionId: string;
  competitionType: "PLAYOFFS" | "NBA_CUP";
  /** Pas encore verrouillés, groupés par jour — ex-écran Matchs. */
  days: MatchDay[];
  /** Verrouillés il y a moins de 3 jours, EN DIRECT en tête puis
   *  anti-chronologique — ex-segment "Récent" de Mes pronos. */
  recentLocked: LockedMatchRow[];
  readyCount: number;
  quotas: QuotaSummary[];
};

export type PlayResultsData = {
  competitionId: string;
  rows: LockedMatchRow[];
  hasMore: boolean;
  availableDates: string[];
  availableSeries: { id: string; label: string }[];
  scopeLeagueId: string | null;
  scopeLeagueName: string | null;
};

const FORWARD_WINDOW_DAYS = 3; // ex-WINDOW_DAYS (écran Matchs)
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RESULTS_LIMIT = 40;
// Aucune convention de fuseau n'existe ailleurs dans le code que Europe/Paris,
// choisi explicitement (le fuseau machine du serveur peut être UTC en
// hébergement) — même choix que les 2 écrans fusionnés.
const DAY_TIMEZONE = "Europe/Paris";

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;
type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };
type TeamRow = { id: string; name: string; abbreviation: string };
type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };
type ActiveUserRow = { id: string; pseudo: string };

type BetSourceRow = {
  id: string;
  user_id: string;
  match_id: string | null;
  series_id: string;
  scope: "SERIES" | "MATCH";
  status: BetStatusValue;
  description: string;
  proposed_category: BetCategory;
  validated_category: BetCategory | null;
  proposed_difficulty: BetDifficulty;
  validated_difficulty: BetDifficulty | null;
  is_admin_corrected: boolean;
  refusal_reason: string | null;
  resolution_reason: string | null;
  points_awarded: number | null;
};

function teamRef(row: TeamRow): TeamRef {
  return { id: row.id, abbreviation: row.abbreviation, name: row.name };
}


function seriesLabel(series: SeriesRow | undefined, abbrevById: Map<string, string>): string {
  if (!series) return "";
  const round = ROUND_LABELS[series.round] ?? series.round;
  const team1 = series.team1_id ? abbrevById.get(series.team1_id) : undefined;
  const team2 = series.team2_id ? abbrevById.get(series.team2_id) : undefined;
  return team1 && team2 ? `${round} — ${team1} vs ${team2}` : round;
}

function matchLabel(gameNumber: number, scheduledAt: string | null): string {
  if (!scheduledAt) return `Match ${gameNumber} — date à confirmer`;
  return `Match ${gameNumber} — ${new Intl.DateTimeFormat("fr-FR", {
    timeZone: DAY_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(scheduledAt))}`;
}

/** Construit le bloc pari d'une ligne — TOUS statuts (décision 3). Une cible
 *  déjà FINISHED ne peut jamais se produire sur une ligne pas-encore-
 *  verrouillée (scheduled_at > now() par construction) : `targetFinished` et
 *  `deadlineOpen` sont donc de simples constantes passées par l'appelant,
 *  jamais recalculées ici. */
function toPlayAssociatedBet(
  b: BetSourceRow,
  targetFinished: boolean,
  deadlineOpen: boolean,
  pendingBetIds: Set<string>
): PlayAssociatedBet {
  return {
    betId: b.id,
    description: b.description,
    category: b.validated_category ?? b.proposed_category,
    difficulty: b.validated_difficulty ?? b.proposed_difficulty,
    isDifficultyValidated: b.validated_difficulty !== null,
    status: b.status,
    isAdminCorrected: b.is_admin_corrected,
    refusalReason: b.refusal_reason,
    resolutionReason: b.resolution_reason,
    pointsAwarded: b.points_awarded,
    isForgottenResolution: b.status === "VALIDATED" && targetFinished,
    hasPendingCorrectionRequest: pendingBetIds.has(b.id),
    reproposeHref: b.status === "REJECTED" && deadlineOpen ? `/play/bets/new?matchId=${b.match_id}` : null,
  };
}

// ============================================================================
// Onglet "Mes pronos" (à suivre)
// ============================================================================

type UpcomingMatchDbRow = {
  id: string;
  series_id: string;
  scheduled_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
};

type OwnPredictionRow = {
  match_id: string;
  predicted_winner_team_id: string | null;
  predicted_margin: number | null;
  status: "DRAFT" | "VALIDATED" | "LOCKED";
};

export async function getPlayUpcoming(): Promise<PlayUpcomingData | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return null;

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowEndIso = new Date(nowMs + FORWARD_WINDOW_DAYS * DAY_MS).toISOString();

  // "Verrouillé mais pas encore FINISHED" — plus de fenêtre de 3 jours ici
  // (18/08/2026, revenu sur la décision 4 de la spec à la demande explicite
  // de l'utilisateur : « tout ce qui est finished doit être dans Résultats
  // et pas dans Mes pronos », quel que soit son âge). §3.1 corrigée.
  const [{ days, readyCount }, recentLocked, quotas] = await Promise.all([
    fetchUpcomingWindow(supabase, user.id, competition, nowIso, windowEndIso, nowMs),
    fetchLockedRows(supabase, user.id, competition.id, { finished: false }, null),
    getQuotas(supabase, user.id, competition),
  ]);

  return {
    competitionId: competition.id,
    competitionType: competition.type,
    days,
    recentLocked: recentLocked.rows,
    readyCount,
    quotas,
  };
}

async function fetchUpcomingWindow(
  supabase: SupabaseServerClient,
  userId: string,
  competition: CompetitionRow,
  nowIso: string,
  windowEndIso: string,
  nowMs: number
): Promise<{ days: MatchDay[]; readyCount: number }> {
  // Fenêtre sur scheduled_at UNIQUEMENT, jamais sur matches.status (T4/A8) —
  // le planificateur (30-60 min) laisse un match commencé en SCHEDULED en
  // base près d'une heure ; filtrer sur le statut ferait déborder ou
  // disparaître des matchs au mauvais moment.
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, series_id, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competition.id)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", nowIso)
    .lte("scheduled_at", windowEndIso)
    .order("scheduled_at", { ascending: true });

  const matches = (matchesData ?? []) as UpcomingMatchDbRow[];
  if (matches.length === 0) return { days: [], readyCount: 0 };

  const matchIds = matches.map((m) => m.id);

  const [
    { data: teamsData },
    { data: ownPredictionsData },
    { data: ownBetsData },
    { data: activeUsersData },
    { data: isAdminData },
  ] = await Promise.all([
    supabase.from("teams").select("id, name, abbreviation"),
    supabase
      .from("match_predictions")
      .select("match_id, predicted_winner_team_id, predicted_margin, status")
      .eq("user_id", userId)
      .in("match_id", matchIds),
    supabase
      .from("bets")
      .select(
        "id, user_id, match_id, series_id, scope, status, description, proposed_category, validated_category, proposed_difficulty, validated_difficulty, is_admin_corrected, refusal_reason, resolution_reason, points_awarded"
      )
      .eq("user_id", userId)
      .eq("competition_id", competition.id)
      .eq("scope", "MATCH")
      .in("match_id", matchIds),
    supabase.from("users").select("id, pseudo").eq("status", "ACTIVE"),
    supabase.rpc("is_admin"),
  ]);

  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, teamRef(t)]));
  const ownPredictionByMatch = new Map(
    ((ownPredictionsData ?? []) as OwnPredictionRow[]).map((row) => [row.match_id, row])
  );
  const ownBets = (ownBetsData ?? []) as BetSourceRow[];
  const ownBetByMatch = new Map(ownBets.map((b) => [b.match_id as string, b]));
  const activeUsers = (activeUsersData ?? []) as ActiveUserRow[];
  const eligibleCount = activeUsers.length;
  const isAdmin = Boolean(isAdminData);

  // predictedCount (X) : fonction SECURITY DEFINER (migration #6) — un simple
  // count() en session joueur sous-compterait tant que l'appelant n'a pas
  // lui-même validé sur CE match précis (même RLS que has_committed_prediction).
  const predictedCounts = await Promise.all(
    matches.map((m) => supabase.rpc("count_committed_predictions", { p_match: m.id }))
  );
  const predictedCountByMatch = new Map(matches.map((m, i) => [m.id, (predictedCounts[i].data as number) ?? 0]));

  // Slots de paris consommés par série (Playoffs) — calculé sur les seuls
  // paris MATCH visibles dans CETTE fenêtre (comme l'écran Matchs d'origine) ;
  // les quotas globaux (bandeau, §3.3 de la spec) sont calculés séparément
  // par getQuotas() sur TOUTE la compétition, pas seulement cette fenêtre.
  const usedSlotsBySeries = new Map<string, number>();
  for (const bet of ownBets) {
    if (!RELEASED_BET_STATUSES.has(bet.status)) {
      usedSlotsBySeries.set(bet.series_id, (usedSlotsBySeries.get(bet.series_id) ?? 0) + 1);
    }
  }

  const cards: UpcomingMatchRow[] = [];
  for (const match of matches) {
    const own = ownPredictionByMatch.get(match.id);
    const viewStatus = deriveViewStatus(own);
    const isRevealed = isAdmin || own?.status === "VALIDATED";

    // Confidentialité dans la requête, pas dans le rendu (patron getBracket) :
    // others/absentees ne sont même pas demandés tant que isRevealed est faux.
    const { others, absentees } = isRevealed
      ? await getRevealedContent(supabase, match.id, userId, activeUsers, teams)
      : { others: [] as OtherPrediction[], absentees: [] as string[] };

    const homeTeam = match.home_team_id ? teams.get(match.home_team_id) : undefined;
    const awayTeam = match.away_team_id ? teams.get(match.away_team_id) : undefined;
    if (!homeTeam || !awayTeam) continue; // garde défensive, ne devrait pas arriver (FK not null en pratique)

    const ownBet = ownBetByMatch.get(match.id);
    const hasBetOnThisMatch = Boolean(ownBet && !RELEASED_BET_STATUSES.has(ownBet.status));
    const betSlot: BetSlotIndicator =
      competition.type === "NBA_CUP"
        ? { mode: "BINARY", hasBetOnThisMatch }
        : {
            mode: "SERIES_QUOTA",
            hasBetOnThisMatch,
            usedSlots: usedSlotsBySeries.get(match.series_id) ?? 0,
            totalSlots: MATCH_SLOT_CAP as 3,
          };

    cards.push({
      isLocked: false,
      matchId: match.id,
      seriesId: match.series_id,
      scheduledAt: match.scheduled_at,
      homeTeam,
      awayTeam,
      myWinnerTeamId: own?.predicted_winner_team_id ?? null,
      myMargin: own?.predicted_margin ?? null,
      viewStatus,
      predictedCount: predictedCountByMatch.get(match.id) ?? 0,
      eligibleCount,
      isRevealed,
      others,
      absentees,
      betSlot,
      // targetFinished=false, deadlineOpen=true : garanti par construction,
      // cette ligne vient de la fenêtre scheduled_at > now() (§3.3).
      bet: ownBet ? toPlayAssociatedBet(ownBet, false, true, new Set()) : null,
    });
  }

  const days = groupByDay(cards, nowMs);
  const readyCount = cards.filter((c) => c.viewStatus === "READY").length;
  return { days, readyCount };
}

function deriveViewStatus(own: OwnPredictionRow | undefined): PredictionViewStatus {
  if (!own) return "TODO";
  if (own.status === "VALIDATED") return "VALIDATED";
  const fieldsSet = (own.predicted_winner_team_id !== null ? 1 : 0) + (own.predicted_margin !== null ? 1 : 0);
  return fieldsSet === 2 ? "READY" : "INCOMPLETE";
}

async function getRevealedContent(
  supabase: SupabaseServerClient,
  matchId: string,
  ownUserId: string,
  activeUsers: ActiveUserRow[],
  teams: Map<string, TeamRef>
): Promise<{ others: OtherPrediction[]; absentees: string[] }> {
  const { data: rowsData } = await supabase
    .from("match_predictions")
    .select("user_id, predicted_winner_team_id, predicted_margin, corrected_by_admin_id, correction_reason")
    .eq("match_id", matchId)
    .neq("status", "DRAFT");

  type Row = {
    user_id: string;
    predicted_winner_team_id: string | null;
    predicted_margin: number | null;
    corrected_by_admin_id: string | null;
    correction_reason: string | null;
  };
  const rows = (rowsData ?? []) as Row[];
  const committedUserIds = new Set(rows.map((r) => r.user_id));

  const userIds = rows.map((r) => r.user_id);
  const adminIds = rows.filter((r) => r.corrected_by_admin_id).map((r) => r.corrected_by_admin_id!);
  const pseudoNeededIds = [...new Set([...userIds, ...adminIds])];
  const { data: profilesData } =
    pseudoNeededIds.length > 0
      ? await supabase.from("users").select("id, pseudo, status").in("id", pseudoNeededIds)
      : { data: [] as { id: string; pseudo: string; status: string }[] };
  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));
  const pseudoById = new Map((profilesData ?? []).map((p) => [p.id, p.pseudo]));

  const others: OtherPrediction[] = rows
    .filter((row) => row.user_id !== ownUserId)
    .map((row) => {
      const profile = profileById.get(row.user_id);
      const team = row.predicted_winner_team_id ? teams.get(row.predicted_winner_team_id) : undefined;
      return {
        userId: row.user_id,
        pseudo: profile?.pseudo ?? "",
        teamAbbreviation: team?.abbreviation ?? "?",
        margin: row.predicted_margin ?? 0,
        adminCorrection: toAdminCorrection(row.corrected_by_admin_id, row.correction_reason, pseudoById),
        isInactive: profile?.status === "DISABLED",
      };
    })
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo));

  const absentees = activeUsers
    .filter((u) => !committedUserIds.has(u.id))
    .map((u) => u.pseudo)
    .sort((a, b) => a.localeCompare(b));

  return { others, absentees };
}

function groupByDay(cards: UpcomingMatchRow[], nowMs: number): MatchDay[] {
  const todayKey = parisDateKey(nowMs);
  const tomorrowKey = parisDateKey(nowMs + DAY_MS);

  const groups = new Map<string, MatchDay>();
  for (const card of cards) {
    const cardMs = Date.parse(card.scheduledAt);
    const key = parisDateKey(cardMs);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(key, todayKey, tomorrowKey, cardMs), matches: [] };
      groups.set(key, group);
    }
    group.matches.push(card);
  }
  // cards déjà triées par scheduledAt croissant (requête) -> l'ordre
  // d'insertion des groupes est déjà chronologique.
  return [...groups.values()];
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string, ms: number): string {
  if (key === todayKey) return "Ce soir";
  if (key === tomorrowKey) return "Demain";
  const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: DAY_TIMEZONE, weekday: "long" }).format(new Date(ms));
  const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: DAY_TIMEZONE, day: "numeric" }).format(new Date(ms));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayNum}`;
}

// ============================================================================
// Lignes VERROUILLÉES — partagées entre "Mes pronos" (recentLocked) et
// "Résultats" (rows). Fusion de la logique de lib/queries/my-predictions.ts.
// ============================================================================

type LockedMatchDbRow = {
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
  winner_points: number | null;
  margin_bonus_points: number | null;
  scored_at: string | null;
};

type CorrectionRequestRow = {
  target_match_prediction_id: string;
  status: "PENDING" | "PROCESSED" | "REJECTED";
  admin_reason: string | null;
  created_at: string;
};

/** Complétude d'un prono — jamais sa présence, jamais son statut brut (règle
 *  non négociable, SPEC_ECRAN_MES_PRONOS_V0_1 §10.4). */
function isComplete(p: PredictionRow): boolean {
  return p.predicted_winner_team_id !== null && p.predicted_margin !== null;
}

function toLiveState(status: LockedMatchDbRow["status"]): MatchLiveState {
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
      // Verrouillé (scheduled_at <= now(), garanti par la sélection) mais le
      // planificateur (30-60 min) n'est pas encore passé dessus — latence
      // assumée (§5.4 SPEC_ECRAN_MES_PRONOS).
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
      winnerPoints: null,
      marginPoints: null,
    };
  }
  const complete = isComplete(own);
  const state: MyPredictionState = complete
    ? "FROZEN"
    : own.predicted_winner_team_id === null && own.predicted_margin === null
      ? "MISSING" // ligne vide laissée par la voie A — jamais INCOMPLETE
      : "INCOMPLETE";
  return {
    state,
    predictedWinner: own.predicted_winner_team_id ? (teams.get(own.predicted_winner_team_id) ?? null) : null,
    predictedMargin: own.predicted_margin,
    isAutoValidated: own.is_auto_validated,
    adminCorrection: toAdminCorrection(own.corrected_by_admin_id, own.correction_reason, pseudoById),
    points: own.scored_at === null ? null : own.points_awarded,
    winnerPoints: own.scored_at === null ? null : own.winner_points,
    marginPoints: own.scored_at === null ? null : own.margin_bonus_points,
  };
}

function toRevealedPrediction(p: PredictionRow, teams: Map<string, TeamRef>, pseudoById: Map<string, string>): RevealedPrediction {
  return {
    userId: p.user_id,
    userName: pseudoById.get(p.user_id) ?? "",
    predictedWinner: p.predicted_winner_team_id ? (teams.get(p.predicted_winner_team_id) ?? null) : null,
    predictedMargin: p.predicted_margin,
    adminCorrection: toAdminCorrection(p.corrected_by_admin_id, p.correction_reason, pseudoById),
    points: p.scored_at === null ? null : p.points_awarded,
  };
}

type LeagueScope = { id: string; name: string; memberUserIds: Set<string> };

/** Récupère des lignes verrouillées, réparties par STATUT (18/08/2026,
 *  décision 4 de la spec inversée à la demande de l'utilisateur — plus par
 *  fenêtre de temps) : `finished: false` = "Mes pronos" (verrouillé, pas
 *  encore FINISHED — inclut IN_PROGRESS et le cas STARTED où le
 *  planificateur, 30-60 min, n'est pas encore passé dessus) ; `finished:
 *  true` = "Résultats" (FINISHED, quel que soit son âge), avec `dateRange`
 *  optionnel pour le filtre `?date=`. Partagé par les deux onglets ; scope
 *  de ligue résolu par l'appelant (null sur Mes pronos, cf. spec). */
async function fetchLockedRows(
  supabase: SupabaseServerClient,
  userId: string,
  competitionId: string,
  criteria: { finished: boolean; dateRange?: { gte: string; lt?: string } },
  scope: LeagueScope | null,
  limit?: number
): Promise<{ rows: LockedMatchRow[]; hasMore: boolean }> {
  let query = supabase
    .from("matches")
    .select("id, series_id, game_number, scheduled_at, home_team_id, away_team_id, status, home_score, away_score")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: false });

  query = criteria.finished
    ? query.eq("status", "FINISHED")
    : query.lte("scheduled_at", new Date().toISOString()).neq("status", "FINISHED");
  if (criteria.dateRange) {
    query = query.gte("scheduled_at", criteria.dateRange.gte);
    if (criteria.dateRange.lt) query = query.lt("scheduled_at", criteria.dateRange.lt);
  }

  // limit+1 pour détecter hasMore sans requête de comptage séparée.
  const { data: pageData } = limit ? await query.limit(limit + 1) : await query;
  const page = (pageData ?? []) as LockedMatchDbRow[];
  const hasMore = limit ? page.length > limit : false;
  const matches = limit && hasMore ? page.slice(0, limit) : page;

  if (matches.length === 0) return { rows: [], hasMore: false };

  const matchIds = matches.map((m) => m.id);

  const [{ data: teamsData }, { data: predictionsData }, { data: betsData }, { data: activeUsersData }] = await Promise.all([
    supabase.from("teams").select("id, name, abbreviation"),
    supabase
      .from("match_predictions")
      .select(
        "id, user_id, match_id, predicted_winner_team_id, predicted_margin, is_auto_validated, corrected_by_admin_id, correction_reason, points_awarded, winner_points, margin_bonus_points, scored_at"
      )
      .in("match_id", matchIds),
    // PAS de filtre user_id (révélation publique 0.2.4 §9) : RLS bet_is_public()
    // renvoie déjà mon pari + les paris PUBLICS des autres, jamais un pari
    // privé d'un autre (C-6, jamais re-filtré ici).
    supabase
      .from("bets")
      .select(
        "id, user_id, match_id, series_id, scope, status, description, proposed_category, validated_category, proposed_difficulty, validated_difficulty, is_admin_corrected, refusal_reason, resolution_reason, points_awarded"
      )
      .eq("competition_id", competitionId)
      .eq("scope", "MATCH")
      .in("match_id", matchIds),
    supabase.from("users").select("id, pseudo").eq("status", "ACTIVE"),
  ]);

  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, teamRef(t)]));
  const predictions = (predictionsData ?? []) as PredictionRow[];
  const bets = (betsData ?? []) as BetSourceRow[];
  const activeUsers = ((activeUsersData ?? []) as ActiveUserRow[]).filter((u) => !scope || scope.memberUserIds.has(u.id));

  const otherAuthorIds = new Set(predictions.filter((p) => p.user_id !== userId && isComplete(p)).map((p) => p.user_id));
  const adminIds = new Set(predictions.filter((p) => p.corrected_by_admin_id).map((p) => p.corrected_by_admin_id!));
  const betAuthorIds = new Set(bets.map((b) => b.user_id));

  const pseudoNeededIds = [...new Set([...otherAuthorIds, ...adminIds, ...betAuthorIds])];
  const { data: profilesData } =
    pseudoNeededIds.length > 0
      ? await supabase.from("users").select("id, pseudo").in("id", pseudoNeededIds)
      : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((profilesData ?? []).map((row) => [row.id as string, row.pseudo as string]));

  const ownPredictionIds = predictions.filter((p) => p.user_id === userId).map((p) => p.id);
  const { data: correctionRequestsData } =
    ownPredictionIds.length > 0
      ? await supabase
          .from("correction_requests")
          .select("target_match_prediction_id, status, admin_reason, created_at")
          .in("target_match_prediction_id", ownPredictionIds)
          .order("created_at", { ascending: false })
      : { data: [] as CorrectionRequestRow[] };
  const correctionRequestByPredictionId = new Map<string, CorrectionRequestRow>();
  for (const row of (correctionRequestsData ?? []) as CorrectionRequestRow[]) {
    if (!correctionRequestByPredictionId.has(row.target_match_prediction_id)) {
      correctionRequestByPredictionId.set(row.target_match_prediction_id, row);
    }
  }

  // Requêtes de correction PENDING sur MES paris de ces matchs — alimente
  // hasPendingCorrectionRequest (cas "pari oublié", §7 SPEC_ECRAN_MES_PARIS).
  const ownBetIds = bets.filter((b) => b.user_id === userId).map((b) => b.id);
  const { data: pendingBetCrData } =
    ownBetIds.length > 0
      ? await supabase
          .from("correction_requests")
          .select("target_bet_id")
          .eq("requester_user_id", userId)
          .eq("status", "PENDING")
          .in("target_bet_id", ownBetIds)
      : { data: [] as { target_bet_id: string }[] };
  const pendingBetIds = new Set((pendingBetCrData ?? []).map((r) => r.target_bet_id));

  const predictionsByMatch = new Map<string, PredictionRow[]>();
  for (const p of predictions) {
    const list = predictionsByMatch.get(p.match_id) ?? [];
    list.push(p);
    predictionsByMatch.set(p.match_id, list);
  }
  const betByMatch = new Map(bets.filter((b) => b.user_id === userId).map((b) => [b.match_id as string, b]));

  const otherBetsByMatch = new Map<string, OtherBet[]>();
  for (const b of bets) {
    if (b.user_id === userId || !b.match_id) continue;
    if (scope && !scope.memberUserIds.has(b.user_id)) continue;
    const list = otherBetsByMatch.get(b.match_id) ?? [];
    list.push({ userId: b.user_id, userName: pseudoById.get(b.user_id) ?? "", description: b.description });
    otherBetsByMatch.set(b.match_id, list);
  }
  for (const list of otherBetsByMatch.values()) list.sort((a, b) => a.userName.localeCompare(b.userName));

  const rows: LockedMatchRow[] = [];
  for (const match of matches) {
    const homeTeam = match.home_team_id ? teams.get(match.home_team_id) : undefined;
    const awayTeam = match.away_team_id ? teams.get(match.away_team_id) : undefined;
    if (!homeTeam || !awayTeam) continue;

    const matchPredictions = predictionsByMatch.get(match.id) ?? [];
    const own = matchPredictions.find((p) => p.user_id === userId);

    const others: RevealedPrediction[] = matchPredictions
      .filter((p) => p.user_id !== userId && isComplete(p))
      .filter((p) => !scope || scope.memberUserIds.has(p.user_id))
      .map((p) => toRevealedPrediction(p, teams, pseudoById))
      .sort((a, b) => a.userName.localeCompare(b.userName));

    const committedUserIds = new Set(matchPredictions.filter(isComplete).map((p) => p.user_id));
    const absenteeCount = activeUsers.filter((u) => !committedUserIds.has(u.id)).length;

    const correctionRequestRow = own ? correctionRequestByPredictionId.get(own.id) : undefined;
    const ownBet = betByMatch.get(match.id);

    rows.push({
      isLocked: true,
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
        ? { status: correctionRequestRow.status, adminReason: correctionRequestRow.admin_reason, createdAt: correctionRequestRow.created_at }
        : null,
      // targetFinished=match.status==="FINISHED", deadlineOpen=false : une
      // ligne verrouillée a toujours scheduled_at <= now(), donc
      // bet_deadline_open() est toujours fermée (§3.3, vérif §13.3).
      bet: ownBet ? toPlayAssociatedBet(ownBet, match.status === "FINISHED", false, pendingBetIds) : null,
      others,
      absenteeCount,
      otherBets: otherBetsByMatch.get(match.id) ?? [],
    });
  }

  // EN DIRECT en tête, puis anti-chronologique (§5.2 SPEC_ECRAN_MES_PRONOS).
  // `matches` est déjà trié anti-chronologiquement (requête) ; tri stable, ne
  // fait que faire remonter les LIVE — sans effet sur "Résultats" (aucune
  // ligne n'y est jamais LIVE, la fenêtre y est strictement < J-3).
  rows.sort((a, b) => Number(b.liveState === "LIVE") - Number(a.liveState === "LIVE"));

  return { rows, hasMore };
}

// ============================================================================
// Onglet "Résultats"
// ============================================================================

export async function getPlayResults(params: {
  date?: string;
  seriesId?: string;
  limit?: number;
  leagueId?: string | null;
}): Promise<PlayResultsData | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (!competition) return null;

  const scopeResolved = await resolveLeagueScope(supabase, params.leagueId);
  const scope: LeagueScope | null = scopeResolved
    ? { id: scopeResolved.id, name: scopeResolved.name, memberUserIds: scopeResolved.memberUserIds }
    : null;

  const limit = params.limit ?? DEFAULT_RESULTS_LIMIT;

  const dateRange = params.date ? (() => {
    const { startIso, endIsoExclusive } = parisDayBoundsUtc(params.date!);
    return { gte: startIso, lt: endIsoExclusive };
  })() : undefined;

  const { availableDates, availableSeries } = await getAvailableFilters(supabase, competition.id);

  const { rows, hasMore } = await fetchLockedRowsFiltered(
    supabase,
    user.id,
    competition.id,
    dateRange,
    params.seriesId ?? null,
    scope,
    limit
  );

  return {
    competitionId: competition.id,
    rows,
    hasMore,
    availableDates,
    availableSeries,
    scopeLeagueId: scope?.id ?? null,
    scopeLeagueName: scope?.name ?? null,
  };
}

/** fetchLockedRows(finished: true) + filtre optionnel par série. */
async function fetchLockedRowsFiltered(
  supabase: SupabaseServerClient,
  userId: string,
  competitionId: string,
  dateRange: { gte: string; lt?: string } | undefined,
  seriesId: string | null,
  scope: LeagueScope | null,
  limit: number
): Promise<{ rows: LockedMatchRow[]; hasMore: boolean }> {
  if (!seriesId) return fetchLockedRows(supabase, userId, competitionId, { finished: true, dateRange }, scope, limit);

  // Filtre série : on repasse par fetchLockedRows (sans limite) puis on
  // filtre en mémoire (une série ne compte jamais plus de 7 matchs, coût
  // négligeable) plutôt que de dupliquer toute la requête pour une clause
  // .eq() de plus.
  const { rows: allRows } = await fetchLockedRows(supabase, userId, competitionId, { finished: true, dateRange }, scope);
  const filtered = allRows.filter((r) => r.seriesId === seriesId);
  const hasMore = filtered.length > limit;
  return { rows: hasMore ? filtered.slice(0, limit) : filtered, hasMore };
}

/** Valeurs proposables par les filtres date/série (§4.2 SPEC_ECRAN_MES_PRONOS)
 *  — dérivées des matchs FINISHED (18/08/2026 : plus d'un cutoff temporel,
 *  cf. fetchLockedRows) : le filtre ne doit proposer que des dates/séries
 *  qui peuvent réellement renvoyer un résultat ici. */
async function getAvailableFilters(
  supabase: SupabaseServerClient,
  competitionId: string
): Promise<{ availableDates: string[]; availableSeries: { id: string; label: string }[] }> {
  const { data: lockedData } = await supabase
    .from("matches")
    .select("series_id, scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .eq("status", "FINISHED");

  const locked = (lockedData ?? []) as { series_id: string; scheduled_at: string }[];
  if (locked.length === 0) return { availableDates: [], availableSeries: [] };

  const dateKeys = new Set<string>();
  const latestMsBySeries = new Map<string, number>();
  for (const row of locked) {
    const ms = Date.parse(row.scheduled_at);
    dateKeys.add(parisDateKey(ms));
    const current = latestMsBySeries.get(row.series_id);
    if (current === undefined || ms > current) latestMsBySeries.set(row.series_id, ms);
  }

  const availableDates = [...dateKeys].sort((a, b) => (a < b ? 1 : -1));

  const seriesIds = [...latestMsBySeries.keys()];
  const [{ data: seriesData }, { data: teamsData }] = await Promise.all([
    supabase.from("series").select("id, round, team1_id, team2_id").in("id", seriesIds),
    supabase.from("teams").select("id, name, abbreviation"),
  ]);
  const abbrevById = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, t.abbreviation]));
  const seriesById = new Map(((seriesData ?? []) as SeriesRow[]).map((s) => [s.id, s]));

  const availableSeries = seriesIds
    .sort((a, b) => (latestMsBySeries.get(b) ?? 0) - (latestMsBySeries.get(a) ?? 0))
    .map((id) => ({ id, label: seriesLabel(seriesById.get(id), abbrevById) }));

  return { availableDates, availableSeries };
}

// ============================================================================
// Quotas — ex-lib/queries/my-bets.ts (buildQuotas), seul reliquat encore
// nécessaire une fois getMyBets() lui-même sans appelant (§2.3 de la spec :
// /play/bets/page.tsx était son seul appelant, supprimé par la refonte).
// ============================================================================

type QuotaBetRow = { series_id: string; match_id: string | null; scope: "SERIES" | "MATCH"; status: BetStatusValue };
type QuotaMatchRow = { id: string; series_id: string; game_number: number; scheduled_at: string | null };

async function getQuotas(supabase: SupabaseServerClient, userId: string, competition: CompetitionRow): Promise<QuotaSummary[]> {
  const { data: betsData } = await supabase
    .from("bets")
    .select("series_id, match_id, scope, status")
    .eq("user_id", userId)
    .eq("competition_id", competition.id);
  const bets = (betsData ?? []) as QuotaBetRow[];
  const activeBets = bets.filter((b) => !RELEASED_BET_STATUSES.has(b.status));
  if (activeBets.length === 0) return [];

  if (competition.type === "NBA_CUP") {
    const matchIds = [...new Set(activeBets.map((b) => b.match_id).filter((id): id is string => id !== null))];
    const { data: matchesData } =
      matchIds.length > 0
        ? await supabase.from("matches").select("id, series_id, game_number, scheduled_at").in("id", matchIds)
        : { data: [] as QuotaMatchRow[] };
    const matchById = new Map(((matchesData ?? []) as QuotaMatchRow[]).map((m) => [m.id, m]));
    return matchIds.map((matchId) => {
      const m = matchById.get(matchId);
      return {
        kind: "NBA_CUP" as const,
        matchId,
        matchLabel: m ? matchLabel(m.game_number, m.scheduled_at) : "—",
        matchSlotUsed: true,
      };
    });
  }

  const seriesIds = [...new Set(activeBets.map((b) => b.series_id))];
  const [{ data: seriesData }, { data: teamsData }] = await Promise.all([
    supabase.from("series").select("id, round, team1_id, team2_id").in("id", seriesIds),
    supabase.from("teams").select("id, name, abbreviation"),
  ]);
  const abbrevById = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, t.abbreviation]));
  const seriesById = new Map(((seriesData ?? []) as SeriesRow[]).map((s) => [s.id, s]));

  return seriesIds.map((seriesId) => {
    const s = seriesById.get(seriesId);
    const seriesBets = activeBets.filter((b) => b.series_id === seriesId);
    return {
      kind: "PLAYOFFS" as const,
      seriesId,
      seriesLabel: seriesLabel(s, abbrevById),
      seriesSlotUsed: seriesBets.some((b) => b.scope === "SERIES"),
      matchSlotsUsed: seriesBets.filter((b) => b.scope === "MATCH").length,
    };
  });
}
