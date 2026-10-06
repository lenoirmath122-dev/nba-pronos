import { getServiceClient } from "@/lib/supabase/service";
import { getMatchesByDate, normalizeMatchStatus, sumQuarters, wentToOvertime, type RawMatch } from "@/lib/nba/client";
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
};

type MatchRow = {
  id: string;
  series_id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  went_to_ot: boolean | null;
  quarter_scores: { homeTeam: number[]; awayTeam: number[] } | null;
};

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

  const hasChanged =
    before.status !== status ||
    before.home_score !== homeScore ||
    before.away_score !== awayScore ||
    before.went_to_ot !== wentToOt ||
    JSON.stringify(before.quarter_scores) !== JSON.stringify(quarterScores);
  if (!hasChanged) {
    result.unchanged++;
    return;
  }

  const { error } = await supabase
    .from("matches")
    .update({ status, home_score: homeScore, away_score: awayScore, went_to_ot: wentToOt, quarter_scores: quarterScores })
    .eq("id", internalId);
  if (error) {
    result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: `échec update : ${error.message}` });
    return;
  }

  await recomputeMatch(internalId);
  await advanceWinnerIfDecided(before.series_id);
  result.changed++;
}
