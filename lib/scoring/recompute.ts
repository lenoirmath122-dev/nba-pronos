import { getServiceClient } from "@/lib/supabase/service";
import { writeSeriesOutcome } from "@/lib/sync/writeSeriesOutcome";
import {
  deriveSeriesOutcome,
  scoreMatchPrediction,
  scoreBracketPick,
  scoreBet,
  type OfficialMatch,
  type SeriesOutcome,
  type CompetitionTypeValue,
  type PlayoffRoundValue,
} from "@/lib/scoring/engine";

// Orchestration IMPURE autour du moteur pur (SPEC_TECHNIQUE_SCORING_V0_1
// §10) — lit les données figées, appelle les fonctions pures, écrit
// UNIQUEMENT les colonnes de scoring (P10 : jamais predicted_*, jamais le
// statut d'une prédiction). Tourne en contexte SYSTÈME (service_role) —
// déclenchée par la synchro, une action admin, ou le filet de sécurité,
// jamais par une action joueur (P2).
//
// Périmètre de CE lot (3/4 de T5) : uniquement recomputeMatch/Series/Bet/
// Competition, telles que décrites au §10.1. PAS l'avancement des équipes
// vers la série suivante (écrire series.team1_id/team2_id) : c'est une
// donnée OFFICIELLE réelle (qui joue contre qui), fournie par la synchro
// (T4, hors périmètre) ou par une résolution admin A2 (lot 4) — jamais
// dérivée en interne ici.
//
// Transaction (§10.3, note d'implémentation) : la spec demande une seule
// transaction par passe (lecture + écriture des colonnes de scoring, et de
// series.official_* si l'agrégat change). supabase-js (REST, pas de
// transaction multi-requêtes côté client) ne permet pas nativement
// d'envelopper plusieurs .update() dans UNE SEULE transaction Postgres
// sans écrire une fonction RPC dédiée. Accepté comme simplification de ce
// lot, compensé par l'IDEMPOTENCE (P5) : une passe interrompue en cours de
// route est rejouable sans risque (jamais de double comptage), le pire cas
// est un état transitoirement incomplet visible entre deux requêtes, pas
// un état FAUX.

const ADMIN_LOCKED_STATUSES = new Set(["CANCELLED", "POSTPONED"]);

// ── recomputeMatch ────────────────────────────────────────────────────────

type MatchRow = {
  id: string;
  series_id: string;
  status: OfficialMatch["status"];
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

type PredictionRow = {
  id: string;
  predicted_winner_team_id: string | null;
  predicted_margin: number | null;
  status: "DRAFT" | "VALIDATED" | "LOCKED";
};

function toOfficialMatch(row: MatchRow): OfficialMatch {
  return {
    id: row.id,
    status: row.status,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
  };
}

/**
 * Un prono est FIGÉ pour le scoring dès qu'il est VALIDATED/LOCKED, OU
 * qu'il est DRAFT mais COMPLET (les 2 champs remplis) — sealDeadlines
 * (l'auto-validation à la deadline) n'est invoquée nulle part dans ce
 * dépôt (ETAT_ACTUEL §2.11) : un DRAFT complet après la deadline du match
 * reste littéralement DRAFT en base pour toujours. Même interprétation
 * "la complétude prime sur le statut brut" déjà actée pour l'écran Mes
 * pronos (§2.11) — pas une nouvelle règle inventée ici, une cohérence
 * avec l'existant.
 */
function isPredictionFrozen(row: PredictionRow): boolean {
  if (row.status === "VALIDATED" || row.status === "LOCKED") return true;
  return row.predicted_winner_team_id !== null && row.predicted_margin !== null;
}

/** §10.1, étape 1-3 : score les pronos d'un match, re-dérive sa série,
 *  écrit series.official_* SI l'agrégat a changé, puis cascade sur
 *  recomputeSeries. */
export async function recomputeMatch(matchId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: matchRow, error: matchErr } = await supabase
    .from("matches")
    .select("id, series_id, status, home_team_id, away_team_id, home_score, away_score")
    .eq("id", matchId)
    .single<MatchRow>();
  if (matchErr || !matchRow) throw new Error(`recomputeMatch : match ${matchId} introuvable (${matchErr?.message})`);

  const officialMatch = toOfficialMatch(matchRow);

  const { data: predictionsData } = await supabase
    .from("match_predictions")
    .select("id, predicted_winner_team_id, predicted_margin, status")
    .eq("match_id", matchId);
  const predictions = (predictionsData ?? []) as PredictionRow[];

  for (const prediction of predictions) {
    const score = scoreMatchPrediction(
      {
        predictedWinnerTeamId: prediction.predicted_winner_team_id,
        predictedMargin: prediction.predicted_margin,
        isFrozen: isPredictionFrozen(prediction),
      },
      officialMatch
    );
    await supabase
      .from("match_predictions")
      .update({
        is_winner_correct: score.isWinnerCorrect,
        margin_diff: score.marginDiff,
        winner_points: score.winnerPoints,
        margin_bonus_points: score.marginBonusPoints,
        scored_at: score.winnerPoints !== null ? new Date().toISOString() : null,
      })
      .eq("id", prediction.id);
  }

  // Étape 2-3 : re-dérive l'agrégat de la série parente.
  const { data: seriesRow, error: seriesErr } = await supabase
    .from("series")
    .select("id, round, competition_id, official_status, official_winner_team_id, official_score_format")
    .eq("id", matchRow.series_id)
    .single();
  if (seriesErr || !seriesRow) throw new Error(`recomputeMatch : série ${matchRow.series_id} introuvable`);

  // Garde-fou d'orchestration (interprétation actée au lot 1, voir
  // lib/scoring/engine.ts) : ne JAMAIS écraser un CANCELLED/POSTPONED déjà
  // posé par un admin — deriveSeriesOutcome ne connaît pas ce statut, ce
  // garde-fou vit ici.
  if (ADMIN_LOCKED_STATUSES.has(seriesRow.official_status)) {
    await recomputeSeries(seriesRow.id);
    return;
  }

  const { data: competitionRow } = await supabase
    .from("competitions")
    .select("type")
    .eq("id", seriesRow.competition_id)
    .single<{ type: CompetitionTypeValue }>();
  const competitionType = competitionRow?.type ?? "PLAYOFFS";

  const { data: seriesMatchData } = await supabase
    .from("matches")
    .select("id, series_id, status, home_team_id, away_team_id, home_score, away_score")
    .eq("series_id", seriesRow.id);
  const seriesMatchRows = (seriesMatchData ?? []) as MatchRow[];
  const derived: SeriesOutcome = deriveSeriesOutcome(seriesMatchRows.map(toOfficialMatch), competitionType);

  const hasChanged =
    derived.status !== seriesRow.official_status ||
    derived.winnerTeamId !== seriesRow.official_winner_team_id ||
    derived.scoreFormat !== seriesRow.official_score_format;

  if (!hasChanged) return; // "on ne rejoue pas pour rien" (§10.3).

  await writeSeriesOutcome({ seriesId: seriesRow.id, ...derived });
  await recomputeSeries(seriesRow.id);
}

// ── recomputeSeries ──────────────────────────────────────────────────────

type SeriesRow = {
  id: string;
  round: PlayoffRoundValue;
  competition_id: string;
  official_status: SeriesOutcome["status"];
  official_winner_team_id: string | null;
  official_score_format: SeriesOutcome["scoreFormat"];
  team1_id: string | null;
  team2_id: string | null;
};

type BracketPickRow = {
  id: string;
  bracket_id: string;
  series_id: string;
  predicted_winner_team_id: string | null;
  predicted_score_format: SeriesOutcome["scoreFormat"];
};

/** §10.1, étape 4 : score tous les picks de bracket d'UNE série, contre son
 *  agrégat officiel actuel (déjà en base — écrit par writeSeriesOutcome,
 *  par la synchro T4, ou par une résolution admin A2, peu importe qui). */
export async function recomputeSeries(seriesId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: seriesRow, error: seriesErr } = await supabase
    .from("series")
    .select("id, round, competition_id, official_status, official_winner_team_id, official_score_format, team1_id, team2_id")
    .eq("id", seriesId)
    .single<SeriesRow>();
  if (seriesErr || !seriesRow) throw new Error(`recomputeSeries : série ${seriesId} introuvable`);

  const { data: picksData } = await supabase
    .from("bracket_picks")
    .select("id, bracket_id, series_id, predicted_winner_team_id, predicted_score_format")
    .eq("series_id", seriesId);
  const picks = (picksData ?? []) as BracketPickRow[];
  if (picks.length === 0) return;

  // Feeders : les 2 séries dont next_series_id == CETTE série (§6.3).
  // ROUND_1/CUP_QUARTERS n'en ont aucune (matchups déjà connus).
  const { data: feedersData } = await supabase
    .from("series")
    .select("id, next_series_slot")
    .eq("next_series_id", seriesId);
  const feeders = (feedersData ?? []) as { id: string; next_series_slot: 1 | 2 }[];

  const feederSlot1Id = feeders.find((f) => f.next_series_slot === 1)?.id ?? null;
  const feederSlot2Id = feeders.find((f) => f.next_series_slot === 2)?.id ?? null;

  type FeederPickRow = { bracket_id: string; series_id: string; predicted_winner_team_id: string | null };
  const feederSeriesIds = [feederSlot1Id, feederSlot2Id].filter((id): id is string => id !== null);
  const { data: feederPicksData } =
    feederSeriesIds.length > 0
      ? await supabase
          .from("bracket_picks")
          .select("bracket_id, series_id, predicted_winner_team_id")
          .in("series_id", feederSeriesIds)
      : { data: [] as FeederPickRow[] };
  const feederPicks = (feederPicksData ?? []) as FeederPickRow[];

  const outcome: SeriesOutcome = {
    status: seriesRow.official_status,
    winnerTeamId: seriesRow.official_winner_team_id,
    scoreFormat: seriesRow.official_score_format,
  };
  const officialPair = { a: seriesRow.team1_id, b: seriesRow.team2_id };

  for (const pick of picks) {
    const predictedPair = {
      a: feederPicks.find((fp) => fp.bracket_id === pick.bracket_id && fp.series_id === feederSlot1Id)
        ?.predicted_winner_team_id ?? null,
      b: feederPicks.find((fp) => fp.bracket_id === pick.bracket_id && fp.series_id === feederSlot2Id)
        ?.predicted_winner_team_id ?? null,
    };

    const score = scoreBracketPick(
      { predictedWinnerTeamId: pick.predicted_winner_team_id, predictedScoreFormat: pick.predicted_score_format },
      seriesRow.round,
      outcome,
      predictedPair,
      officialPair
    );

    // scored_at : posé dès qu'AU MOINS une composante a été déterminée
    // (même partiellement — l'affiche peut se scorer avant le vainqueur,
    // §6.3) ; NULL si les 3 composantes restent en attente.
    const hasAnyComponent = score.winnerPoints !== null || score.exactScorePoints !== null || score.matchupPoints !== null;

    await supabase
      .from("bracket_picks")
      .update({
        is_winner_correct: score.isWinnerCorrect,
        is_score_exact: score.isScoreExact,
        is_matchup_correct: score.isMatchupCorrect,
        winner_points: score.winnerPoints,
        exact_score_points: score.exactScorePoints,
        matchup_points: score.matchupPoints,
        scored_at: hasAnyComponent ? new Date().toISOString() : null,
      })
      .eq("id", pick.id);
  }
}

// ── recomputeBet ─────────────────────────────────────────────────────────

type BetRow = { id: string; status: string; validated_difficulty: number | null };

/** §10.1 : un pari résolu par l'admin (chemin B, §2) — mapping pur
 *  statut+difficulté → points, aucune dépendance série/match. */
export async function recomputeBet(betId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: betRow, error } = await supabase
    .from("bets")
    .select("id, status, validated_difficulty")
    .eq("id", betId)
    .single<BetRow>();
  if (error || !betRow) throw new Error(`recomputeBet : pari ${betId} introuvable (${error?.message})`);

  const score = scoreBet({
    status: betRow.status as Parameters<typeof scoreBet>[0]["status"],
    validatedDifficulty: betRow.validated_difficulty,
  });

  await supabase
    .from("bets")
    .update({
      points_awarded: score.pointsAwarded,
      scored_at: score.pointsAwarded !== null ? new Date().toISOString() : null,
    })
    .eq("id", betId);
}

// ── recomputeCompetition ─────────────────────────────────────────────────

/** Filet de sécurité admin (synthèse §7 / bouton « Recalculer ») : rejoue
 *  TOUT le barème d'une compétition. Idempotent, ordre de parcours sans
 *  effet sur le résultat (§10.2). Boucles séquentielles (pas de
 *  parallélisation) — filet de sécurité, pas un chemin chaud. */
export async function recomputeCompetition(competitionId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: matches } = await supabase.from("matches").select("id").eq("competition_id", competitionId);
  for (const match of matches ?? []) {
    await recomputeMatch(match.id);
  }

  const { data: series } = await supabase.from("series").select("id").eq("competition_id", competitionId);
  for (const s of series ?? []) {
    await recomputeSeries(s.id);
  }

  const { data: bets } = await supabase.from("bets").select("id").eq("competition_id", competitionId);
  for (const bet of bets ?? []) {
    await recomputeBet(bet.id);
  }
}
