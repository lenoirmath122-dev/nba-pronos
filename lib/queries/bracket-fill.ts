import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Lecture de l'écran Bracket personnel (remplissage), composants serveur
// uniquement — SPEC_ECRAN_BRACKET_PERSONNEL_V0_1 §7. Module DISTINCT de
// lib/queries/bracket.ts (vue globale, lecture seule, pas de userId) : les
// deux écrans ont des contrats de types différents, mélanger les deux
// aurait forcé des champs sans rapport (groupes/pourcentages ici, pick
// personnel là-bas).
//
// RÈGLE NON NÉGOCIABLE (leçon retenue d'un bug réel du prototype, §0 de la
// spec) : la dérivation des équipes CANDIDATES d'un tour 2+ ne lit JAMAIS le
// résultat OFFICIEL de la série précédente — SEULEMENT le pick du JOUEUR sur
// cette série. `computeCandidateTeamIds` est PURE et exportée pour être
// réutilisée À L'IDENTIQUE par lib/actions/bracket-fill.ts (validation
// serveur d'un pick soumis) — une seule implémentation de la cascade, jamais
// deux qui divergent.

export type BetSeriesFormat = "4-0" | "4-1" | "4-2" | "4-3";

export type BracketFillCandidate = { teamId: string; abbreviation: string; name: string } | null;

/** Pari SÉRIE actif sur cette série, éditable ICI (DRAFT/SUBMITTED
 *  uniquement — un pari VALIDATED/WON/LOST reste "posé" mais pas réouvrable,
 *  même convention que MyMatchBet, lib/queries/matches.ts). */
export type MySeriesBet = {
  betId: string;
  status: "DRAFT" | "SUBMITTED";
  description: string;
  category: BetCategory;
  difficulty: BetDifficulty;
};

export type BracketFillSeries = {
  seriesId: string;
  round: string;
  conference: "EAST" | "WEST" | null;
  teamA: BracketFillCandidate;
  teamB: BracketFillCandidate;
  isSelectable: boolean; // true seulement si teamA ET teamB connus
  myPick: {
    winnerTeamId: string | null;
    scoreFormat: BetSeriesFormat | null; // toujours null en NBA Cup
  };
  /** Un pari (tout statut confondu) occupe déjà le slot SÉRIE de cette série
   *  (paris centralisés dans Bracket, demandé par l'utilisateur 28/07/2026 —
   *  même patron que betSlot/myBet de l'écran Matchs pour les paris MATCH). */
  hasBet: boolean;
  myBet: MySeriesBet | null;
  /** Reproduit public.bet_deadline_open(SERIES, ...) (T3 §2) : coup d'envoi
   *  du 1er match de la série — true si AUCUN match n'est encore programmé
   *  (deadline toujours ouverte). Sert au décompte "paris séries restants"
   *  (hub Jouer, Accueil — demandé par l'utilisateur 28/07/2026), PAS de
   *  garde d'écriture ici (déjà portée par la fonction SQL save_bet). */
  isBetDeadlinePassed: boolean;
};

export type BracketFillRound = { key: string; label: string; series: BracketFillSeries[] };

export type BracketFillData = {
  competitionId: string | null; // null = aucune compétition active
  competitionType: "PLAYOFFS" | "NBA_CUP";
  isStructureKnown: boolean; // false = 1er tour/8 qualifiés Cup pas encore connus
  deadline: string | null; // ISO
  isDeadlinePassed: boolean;
  isValidated: boolean;
  isAutoValidated: boolean;
  rounds: BracketFillRound[];
  filledCount: number;
  totalCount: number; // 15 (Playoffs) ou 7 (NBA Cup)
};

function emptyData(): BracketFillData {
  return {
    competitionId: null,
    competitionType: "PLAYOFFS", // valeur inerte, jamais lue (competitionId testé en premier)
    isStructureKnown: false,
    deadline: null,
    isDeadlinePassed: false,
    isValidated: false,
    isAutoValidated: false,
    rounds: [],
    filledCount: 0,
    totalCount: 0,
  };
}

const PLAYOFFS_ROUNDS = ["ROUND_1", "CONF_SEMIS", "CONF_FINALS", "NBA_FINALS"] as const;
const CUP_ROUNDS = ["CUP_QUARTERS", "CUP_SEMIS", "CUP_FINAL"] as const;
const CONFERENCE_RANK: Record<string, number> = { EAST: 0, WEST: 1 };

// Tour "racine" : ses 2 équipes sont OFFICIELLES (team1_id/team2_id), pas
// dérivées d'un pick. Tous les tours suivants dérivent de la cascade (§3).
function isRootRound(round: string, competitionType: "PLAYOFFS" | "NBA_CUP"): boolean {
  return competitionType === "PLAYOFFS" ? round === "ROUND_1" : round === "CUP_QUARTERS";
}

export type CascadeSeriesRow = {
  id: string;
  round: string;
  next_series_id: string | null;
  next_series_slot: number | null;
  team1_id: string | null;
  team2_id: string | null;
};

/** Calcule les 2 équipes CANDIDATES de chaque série, PURE — voir avertissement
 *  en tête de fichier. `myWinnerBySeriesId` = pick du joueur (vainqueur
 *  choisi), PAS le résultat officiel. */
export function computeCandidateTeamIds(
  series: CascadeSeriesRow[],
  myWinnerBySeriesId: Map<string, string | null>,
  competitionType: "PLAYOFFS" | "NBA_CUP"
): Map<string, { teamAId: string | null; teamBId: string | null }> {
  const feedersByNextSeriesId = new Map<string, CascadeSeriesRow[]>();
  for (const s of series) {
    if (s.next_series_id) {
      const list = feedersByNextSeriesId.get(s.next_series_id) ?? [];
      list.push(s);
      feedersByNextSeriesId.set(s.next_series_id, list);
    }
  }
  for (const list of feedersByNextSeriesId.values()) {
    list.sort((a, b) => (a.next_series_slot ?? 0) - (b.next_series_slot ?? 0));
  }

  const result = new Map<string, { teamAId: string | null; teamBId: string | null }>();
  for (const s of series) {
    if (isRootRound(s.round, competitionType)) {
      result.set(s.id, { teamAId: s.team1_id, teamBId: s.team2_id });
      continue;
    }
    const feeders = feedersByNextSeriesId.get(s.id) ?? [];
    const teamAId = feeders[0] ? (myWinnerBySeriesId.get(feeders[0].id) ?? null) : null;
    const teamBId = feeders[1] ? (myWinnerBySeriesId.get(feeders[1].id) ?? null) : null;
    result.set(s.id, { teamAId, teamBId });
  }
  return result;
}

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP"; bracket_deadline: string | null };

type SeriesRow = CascadeSeriesRow & { conference: "EAST" | "WEST" | null; slot_index: number };

type TeamRow = { id: string; name: string; abbreviation: string };

type BracketRow = { id: string; is_validated: boolean; is_auto_validated: boolean };

type BracketPickRow = {
  series_id: string;
  predicted_winner_team_id: string | null;
  predicted_score_format: BetSeriesFormat | null;
};

type SeriesBetRow = {
  id: string;
  series_id: string;
  status: "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";
  description: string;
  proposed_category: BetCategory;
  proposed_difficulty: BetDifficulty;
};

// Un pari REJECTED/CANCELLED libère toujours son slot (0.2.4 §6, même
// convention que lib/queries/matches.ts) — ce sont donc les SEULS statuts
// qu'on exclut ici : au plus une ligne active peut matcher par série
// (uniq_active_series_bet).
const RELEASED_SERIES_BET_STATUSES = new Set(["REJECTED", "CANCELLED"]);

export async function getBracketFillData(): Promise<BracketFillData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyData();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type, bracket_deadline")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return emptyData();

  const deadline = competition.bracket_deadline;
  const isDeadlinePassed = deadline !== null && Date.parse(deadline) <= Date.now();

  const { data: seriesData } = await supabase
    .from("series")
    .select("id, round, conference, slot_index, team1_id, team2_id, next_series_id, next_series_slot")
    .eq("competition_id", competition.id);
  const series = (seriesData ?? []) as SeriesRow[];

  // NBA Cup avant qualification des 8 : aucune série en base (même
  // convention que lib/queries/bracket.ts).
  const isStructureKnown = series.length > 0;
  if (!isStructureKnown) {
    return {
      competitionId: competition.id,
      competitionType: competition.type,
      isStructureKnown: false,
      deadline,
      isDeadlinePassed,
      isValidated: false,
      isAutoValidated: false,
      rounds: [],
      filledCount: 0,
      totalCount: 0,
    };
  }

  const [{ data: teamsData }, { data: bracketData }] = await Promise.all([
    supabase.from("teams").select("id, name, abbreviation"),
    supabase
      .from("brackets")
      .select("id, is_validated, is_auto_validated")
      .eq("user_id", user.id)
      .eq("competition_id", competition.id)
      .maybeSingle<BracketRow>(),
  ]);

  const teams = new Map(
    ((teamsData ?? []) as TeamRow[]).map((t) => [t.id, { name: t.name, abbreviation: t.abbreviation }])
  );

  // Pas encore de bracket créé (aucun pick posé) : état de départ légitime,
  // pas une erreur — le bracket sera créé au 1er pick (lib/actions/bracket-fill.ts).
  const { data: picksData } = bracketData
    ? await supabase
        .from("bracket_picks")
        .select("series_id, predicted_winner_team_id, predicted_score_format")
        .eq("bracket_id", bracketData.id)
    : { data: [] as BracketPickRow[] };
  const picks = (picksData ?? []) as BracketPickRow[];

  const myWinnerBySeriesId = new Map(picks.map((p) => [p.series_id, p.predicted_winner_team_id]));
  const myPickBySeriesId = new Map(
    picks.map((p) => [p.series_id, { winnerTeamId: p.predicted_winner_team_id, scoreFormat: p.predicted_score_format }])
  );

  // Paris SÉRIE actifs (0 ou 1 par série, uniq_active_series_bet) — pour
  // centraliser la saisie inline directement sur la carte de série.
  const { data: seriesBetsData } = await supabase
    .from("bets")
    .select("id, series_id, status, description, proposed_category, proposed_difficulty")
    .eq("user_id", user.id)
    .eq("competition_id", competition.id)
    .eq("scope", "SERIES")
    .in(
      "series_id",
      series.map((s) => s.id)
    );
  const seriesBetBySeriesId = new Map(
    ((seriesBetsData ?? []) as SeriesBetRow[])
      .filter((row) => !RELEASED_SERIES_BET_STATUSES.has(row.status))
      .map((row) => [row.series_id, row])
  );

  const candidatesBySeriesId = computeCandidateTeamIds(series, myWinnerBySeriesId, competition.type);

  // Coup d'envoi le plus tôt par série — sert à l'ordre d'affichage en NBA
  // Cup (slot_index seul ne reflète pas l'ordre réel des demies/finale) ET à
  // la deadline des paris SÉRIE (public.bet_deadline_open, T3 §2 : "min(
  // scheduled_at) des matchs de la série"), pour les DEUX types de
  // compétition — plus seulement conditionné à NBA_CUP comme avant l'ajout
  // des paris séries (28/07/2026).
  const earliestKickoffBySeries = new Map<string, number>();
  {
    const { data: matches } = await supabase
      .from("matches")
      .select("series_id, scheduled_at")
      .eq("competition_id", competition.id)
      .not("scheduled_at", "is", null);
    for (const match of matches ?? []) {
      const seriesId = match.series_id as string;
      const scheduledMs = Date.parse(match.scheduled_at as string);
      const current = earliestKickoffBySeries.get(seriesId);
      if (current === undefined || scheduledMs < current) {
        earliestKickoffBySeries.set(seriesId, scheduledMs);
      }
    }
  }

  const roundOrder = competition.type === "PLAYOFFS" ? PLAYOFFS_ROUNDS : CUP_ROUNDS;

  const rounds: BracketFillRound[] = roundOrder
    .map((roundKey) => {
      const roundSeries = series
        .filter((row) => row.round === roundKey)
        .sort((a, b) =>
          competition.type === "PLAYOFFS"
            ? conferenceRank(a.conference) - conferenceRank(b.conference) || a.slot_index - b.slot_index
            : kickoff(earliestKickoffBySeries, a.id) - kickoff(earliestKickoffBySeries, b.id) ||
              a.slot_index - b.slot_index
        );

      const seriesOut: BracketFillSeries[] = roundSeries.map((row) => {
        const candidates = candidatesBySeriesId.get(row.id) ?? { teamAId: null, teamBId: null };
        const teamA = candidates.teamAId ? resolveTeam(teams, candidates.teamAId) : null;
        const teamB = candidates.teamBId ? resolveTeam(teams, candidates.teamBId) : null;
        const seriesBet = seriesBetBySeriesId.get(row.id);
        const isBetEditable = seriesBet?.status === "DRAFT" || seriesBet?.status === "SUBMITTED";
        const earliestKickoffMs = earliestKickoffBySeries.get(row.id);
        return {
          seriesId: row.id,
          round: row.round,
          conference: row.conference,
          teamA,
          teamB,
          isSelectable: teamA !== null && teamB !== null,
          myPick: myPickBySeriesId.get(row.id) ?? { winnerTeamId: null, scoreFormat: null },
          hasBet: seriesBet !== undefined,
          myBet:
            seriesBet && isBetEditable
              ? {
                  betId: seriesBet.id,
                  status: seriesBet.status as "DRAFT" | "SUBMITTED",
                  description: seriesBet.description,
                  category: seriesBet.proposed_category,
                  difficulty: seriesBet.proposed_difficulty,
                }
              : null,
          isBetDeadlinePassed: earliestKickoffMs !== undefined && earliestKickoffMs <= Date.now(),
        };
      });

      return { key: roundKey, label: ROUND_LABELS[roundKey], series: seriesOut };
    })
    .filter((round) => round.series.length > 0);

  // Rempli = vainqueur choisi ET (score choisi OU NBA Cup, qui n'en a pas) —
  // même convention que lib/queries/bracket.ts (getBracketTodo).
  const filledCount = picks.filter(
    (p) => p.predicted_winner_team_id !== null && (competition.type === "NBA_CUP" || p.predicted_score_format !== null)
  ).length;

  return {
    competitionId: competition.id,
    competitionType: competition.type,
    isStructureKnown: true,
    deadline,
    isDeadlinePassed,
    isValidated: bracketData?.is_validated ?? false,
    isAutoValidated: bracketData?.is_auto_validated ?? false,
    rounds,
    filledCount,
    totalCount: series.length,
  };
}

/** Séries où un pari SÉRIE reste POSSIBLE et pas encore posé — "restants",
 *  demandé par l'utilisateur (28/07/2026) pour la carte Bracket du hub Jouer
 *  et la section Accueil dédiée. NBA Cup exclue (pas de paris séries, une
 *  "série" y est 1 seul match). Fonction PURE, réutilisée par
 *  lib/queries/play-hub.ts et lib/queries/home.ts — jamais recalculée deux
 *  fois avec une logique divergente. */
export function getRemainingSeriesBets(data: BracketFillData): BracketFillSeries[] {
  if (data.competitionType !== "PLAYOFFS") return [];
  return data.rounds
    .flatMap((round) => round.series)
    .filter((s) => s.isSelectable && !s.hasBet && !s.isBetDeadlinePassed);
}

function resolveTeam(teams: Map<string, { name: string; abbreviation: string }>, teamId: string): BracketFillCandidate {
  const team = teams.get(teamId);
  return team ? { teamId, abbreviation: team.abbreviation, name: team.name } : null;
}

function conferenceRank(conference: "EAST" | "WEST" | null): number {
  return conference ? (CONFERENCE_RANK[conference] ?? 2) : 2;
}

function kickoff(map: Map<string, number>, seriesId: string): number {
  return map.get(seriesId) ?? Number.POSITIVE_INFINITY;
}
