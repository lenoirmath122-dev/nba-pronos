import { getServiceClient } from "@/lib/supabase/service";
import { getMatchesByDate, normalizeMatchStatus, sumQuarters, type RawMatch } from "@/lib/nba/client";
import { nyDateString } from "@/lib/dates/newyork";
import { recomputeMatch } from "@/lib/scoring/recompute";
import { advanceWinnerIfDecided } from "@/lib/scoring/advancement";

// Writer de /api/sync/results (SPEC_TECHNIQUE_SYNCHRO_V0.1 §6/§8). Scope
// volontairement restreint aux matchs DÉJÀ mappés (entity_mappings, posés par
// lib/sync/schedule.ts) — l'attache match→série est la responsabilité du job
// schedule, pas de celui-ci (§6, séparation des rôles). Un match du jour pas
// encore mappé est journalisé et laissé au prochain passage de schedule.
//
// Même patron que lib/actions/admin-results.ts::saveMatchResult (écriture
// admin manuelle) : update matches → recomputeMatch → advanceWinnerIfDecided.

export type SkippedResultMatch = { highlightlyMatchId: number; reason: string };

export type SyncResultsResult = {
  changed: number;
  unchanged: number;
  skipped: SkippedResultMatch[];
  requestsRemaining: number | null;
};

type MatchRow = { id: string; series_id: string; status: string; home_score: number | null; away_score: number | null };

/** `referenceDate` : "aujourd'hui" en production — override dev/test, même
 *  convention que lib/sync/schedule.ts. */
export async function syncResults(referenceDate: Date = new Date()): Promise<SyncResultsResult> {
  const supabase = getServiceClient();
  const result: SyncResultsResult = { changed: 0, unchanged: 0, skipped: [], requestsRemaining: null };

  const { data: rawMatches, requestsRemaining } = await getMatchesByDate(nyDateString(referenceDate));
  result.requestsRemaining = requestsRemaining;
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
      ? await supabase.from("matches").select("id, series_id, status, home_score, away_score").in("id", internalIds)
      : { data: [] as MatchRow[] };
  const matchRowById = new Map<string, MatchRow>((matchRowsData ?? []).map((r) => [r.id as string, r as MatchRow]));

  for (const rawMatch of rawMatches) {
    await processOneMatch(supabase, rawMatch, internalIdBySourceRef, matchRowById, result);
  }

  return result;
}

async function processOneMatch(
  supabase: ReturnType<typeof getServiceClient>,
  rawMatch: RawMatch,
  internalIdBySourceRef: Map<string, string>,
  matchRowById: Map<string, MatchRow>,
  result: SyncResultsResult
): Promise<void> {
  const internalId = internalIdBySourceRef.get(String(rawMatch.id));
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
  const status = normalizeMatchStatus(rawMatch.state.description).status;

  const hasChanged = before.status !== status || before.home_score !== homeScore || before.away_score !== awayScore;
  if (!hasChanged) {
    result.unchanged++;
    return;
  }

  const { error } = await supabase
    .from("matches")
    .update({ status, home_score: homeScore, away_score: awayScore })
    .eq("id", internalId);
  if (error) {
    result.skipped.push({ highlightlyMatchId: rawMatch.id, reason: `échec update : ${error.message}` });
    return;
  }

  await recomputeMatch(internalId);
  await advanceWinnerIfDecided(before.series_id);
  result.changed++;
}
