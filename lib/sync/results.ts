import { getServiceClient } from "@/lib/supabase/service";
import {
  getMatchesByDate,
  normalizeMatchStatus,
  sumQuarters,
  wentToOvertime,
  type NormalizedMatchStatus,
  type RawMatch,
} from "@/lib/nba/client";
import { nyResultDates } from "@/lib/dates/newyork";
import { recomputeMatch } from "@/lib/scoring/recompute";
import { advanceWinnerIfDecided } from "@/lib/scoring/advancement";
import type { CompetitionType } from "@/lib/competitions/types";

// Writer de /api/sync/results (SPEC_TECHNIQUE_SYNCHRO_V0.1 §6/§8). Scope
// volontairement restreint aux matchs DÉJÀ mappés (entity_mappings, posés par
// lib/sync/schedule.ts) — l'attache match→série est la responsabilité du job
// schedule, pas de celui-ci (§6, séparation des rôles). Un match du jour pas
// encore mappé est journalisé et laissé au prochain passage de schedule.
//
// Même patron que lib/actions/admin-results.ts::saveMatchResult (écriture
// admin manuelle) : update matches → recomputeMatch → advanceWinnerIfDecided.

export type SkippedResultMatch = { highlightlyMatchId: number; reason: string };

// Correctif post-audit (28/07/2026, GAPS_OUVERTS.md) : voir la même note dans
// lib/sync/schedule.ts — `recognized: false` collecté et remonté, plus jamais
// ignoré silencieusement.
export type UnrecognizedStatus = { highlightlyMatchId: number; description: string };

// Date NY dont l'appel Highlightly a échoué alors qu'une autre date a abouti
// (voir syncResults) : remontée plutôt que d'interrompre tout le sync.
export type FailedResultDate = { date: string; message: string };

export type SyncResultsResult = {
  changed: number;
  unchanged: number;
  skipped: SkippedResultMatch[];
  /** DAILY_MATCH : matchs du jour non tirés (jamais mappés par construction), comptés au lieu d'être listés. */
  notDrawn: number;
  failedDates: FailedResultDate[];
  unrecognizedStatuses: UnrecognizedStatus[];
  requestsRemaining: number | null;
  /** Ids internes des matchs passés à FINISHED pendant ce passage (déclenche la résolution des paris). */
  finishedNow: string[];
};

export type QuarterScores = { homeTeam: number[]; awayTeam: number[] };

/** Champs de résultat d'un match — partagés par toutes les sources (Highlightly, NBA). */
export type MatchResultFields = {
  status: NormalizedMatchStatus;
  home_score: number | null;
  away_score: number | null;
  went_to_ot: boolean | null;
  quarter_scores: QuarterScores | null;
};

export type MatchRow = MatchResultFields & {
  id: string;
  series_id: string;
};

export function hasResultChanged(before: MatchResultFields, next: MatchResultFields): boolean {
  return (
    before.status !== next.status ||
    before.home_score !== next.home_score ||
    before.away_score !== next.away_score ||
    before.went_to_ot !== next.went_to_ot ||
    JSON.stringify(before.quarter_scores) !== JSON.stringify(next.quarter_scores)
  );
}

/** Une source automatique ne fait jamais reculer un match : un FINISHED reste
 *  FINISHED (une correction de score reste permise, mais pas un report ou une
 *  annulation : seul l'admin peut défaire un match terminé) et un IN_PROGRESS
 *  ne redevient pas SCHEDULED. Protège notamment d'un statut Highlightly non
 *  reconnu (retombé sur IN_PROGRESS) écrasant un match déjà terminé. */
export function isStatusRegression(from: string, to: string): boolean {
  if (from === "FINISHED") return to !== "FINISHED";
  if (from === "IN_PROGRESS") return to === "SCHEDULED";
  return false;
}

export type ApplyMatchResultOutcome =
  | { outcome: "changed"; finishedNow: boolean }
  | { outcome: "unchanged" }
  | { outcome: "regression" }
  | { outcome: "concurrent" }
  | { outcome: "failed"; message: string };

/** Écrit le résultat d'un match puis recalcule le scoring (patron de
 *  lib/actions/admin-results.ts::saveMatchResult). Idempotent : sans
 *  changement, aucune écriture. Le `.eq("status", before.status)` détecte une
 *  écriture concurrente (autre source, admin) entre la lecture et l'update. */
export async function applyMatchResult(
  supabase: ReturnType<typeof getServiceClient>,
  before: MatchRow,
  next: MatchResultFields
): Promise<ApplyMatchResultOutcome> {
  if (!hasResultChanged(before, next)) return { outcome: "unchanged" };
  if (isStatusRegression(before.status, next.status)) return { outcome: "regression" };

  const { data, error } = await supabase
    .from("matches")
    .update({
      status: next.status,
      home_score: next.home_score,
      away_score: next.away_score,
      went_to_ot: next.went_to_ot,
      quarter_scores: next.quarter_scores,
    })
    .eq("id", before.id)
    .eq("status", before.status)
    .select("id");
  if (error) return { outcome: "failed", message: error.message };
  if (!data || data.length === 0) return { outcome: "concurrent" };

  await recomputeMatch(before.id);
  await advanceWinnerIfDecided(before.series_id);
  return { outcome: "changed", finishedNow: before.status !== "FINISHED" && next.status === "FINISHED" };
}

/** `referenceDate` : "aujourd'hui" en production — override dev/test, même
 *  convention que lib/sync/schedule.ts. */
export async function syncResults(referenceDate: Date = new Date()): Promise<SyncResultsResult> {
  const supabase = getServiceClient();
  const result: SyncResultsResult = {
    changed: 0,
    unchanged: 0,
    skipped: [],
    notDrawn: 0,
    failedDates: [],
    unrecognizedStatuses: [],
    requestsRemaining: null,
    finishedNow: [],
  };

  // Veille NY incluse pendant les premières heures du jour NY : un match fini
  // après minuit ET n'est plus renvoyé sous le jour courant (nyResultDates).
  const rawMatchById = new Map<number, RawMatch>();
  // Une date en échec n'empêche pas de traiter l'autre ; si TOUTES échouent,
  // on relance l'erreur (la route la journalise en échec comme avant).
  const dates = nyResultDates(referenceDate);
  let firstError: unknown = null;
  for (const date of dates) {
    try {
      const { data, requestsRemaining } = await getMatchesByDate(date);
      result.requestsRemaining = requestsRemaining;
      for (const m of data) rawMatchById.set(m.id, m);
    } catch (error) {
      firstError ??= error;
      result.failedDates.push({ date, message: error instanceof Error ? error.message : "Erreur inconnue." });
    }
  }
  if (result.failedDates.length === dates.length) throw firstError;
  const rawMatches = [...rawMatchById.values()];
  if (rawMatches.length === 0) return result;

  const sourceRefs = rawMatches.map((m) => String(m.id));
  const { data: matchMapData } = await supabase
    .from("entity_mappings")
    .select("internal_id, source_ref")
    .eq("entity_type", "MATCH")
    .eq("source_type", "HIGHLIGHTLY")
    .in("source_ref", sourceRefs);
  const internalIdBySourceRef = new Map<string, string>(
    (matchMapData ?? []).map((r) => [r.source_ref as string, r.internal_id as string])
  );

  const internalIds = [...internalIdBySourceRef.values()];
  const { data: matchRowsData } =
    internalIds.length > 0
      ? await supabase
          .from("matches")
          .select("id, series_id, status, home_score, away_score, went_to_ot, quarter_scores")
          .in("id", internalIds)
      : { data: [] as MatchRow[] };
  const matchRowById = new Map<string, MatchRow>((matchRowsData ?? []).map((r) => [r.id as string, r as MatchRow]));

  // En DAILY_MATCH, un seul match par jour est mappé : les autres ne sont pas
  // une anomalie (30 min x 5 à 15 matchs de bruit dans sync_logs sinon).
  const { data: activeCompetition } = await supabase
    .from("competitions")
    .select("type")
    .eq("status", "ACTIVE")
    .maybeSingle<{ type: CompetitionType }>();
  const isDaily = activeCompetition?.type === "DAILY_MATCH";

  for (const rawMatch of rawMatches) {
    await processOneMatch(supabase, rawMatch, internalIdBySourceRef, matchRowById, result, isDaily);
  }

  return result;
}

async function processOneMatch(
  supabase: ReturnType<typeof getServiceClient>,
  rawMatch: RawMatch,
  internalIdBySourceRef: Map<string, string>,
  matchRowById: Map<string, MatchRow>,
  result: SyncResultsResult,
  isDaily: boolean
): Promise<void> {
  const internalId = internalIdBySourceRef.get(String(rawMatch.id));
  if (!internalId && isDaily) {
    result.notDrawn++;
    return;
  }
  if (!internalId) {
    result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: "match non mappé (schedule ne l'a pas encore attaché)" });
    return;
  }
  const before = matchRowById.get(internalId);
  if (!before) {
    result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: `match interne ${internalId} introuvable` });
    return;
  }

  const homeScore = sumQuarters(rawMatch.state.score.homeTeam);
  const awayScore = sumQuarters(rawMatch.state.score.awayTeam);
  // Chantier "prolongation" (GAPS_OUVERTS.md, 24/08/2026) -- même tableau
  // que homeScore/awayScore ci-dessus, lu une 2e fois pour son signal OT.
  const wentToOt = wentToOvertime(rawMatch.state.score.homeTeam);
  // Chantier "pari période" équipe (GAPS_OUVERTS.md, 24/08/2026) -- même
  // tableau lu une 3e fois, persisté tel quel cette fois (pas juste sommé/
  // sondé) pour la résolution des paris quart-temps/mi-temps.
  const quarterScores = { homeTeam: rawMatch.state.score.homeTeam, awayTeam: rawMatch.state.score.awayTeam };
  const { status, recognized } = normalizeMatchStatus(rawMatch.state.description);
  if (!recognized) {
    result.unrecognizedStatuses.push({ highlightlyMatchId: rawMatch.id, description: rawMatch.state.description });
  }

  const applied = await applyMatchResult(supabase, before, {
    status,
    home_score: homeScore,
    away_score: awayScore,
    went_to_ot: wentToOt,
    quarter_scores: quarterScores,
  });
  switch (applied.outcome) {
    case "unchanged":
      result.unchanged++;
      return;
    case "changed":
      result.changed++;
      if (applied.finishedNow) result.finishedNow.push(internalId);
      return;
    case "regression":
      result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: `régression de statut refusée (${before.status} -> ${status})` });
      return;
    case "concurrent":
      result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: "écriture concurrente, repris au prochain passage" });
      return;
    case "failed":
      result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: `échec update : ${applied.message}` });
      return;
  }
}
