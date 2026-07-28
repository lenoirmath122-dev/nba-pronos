import { getServiceClient } from "@/lib/supabase/service";
import { getMatchesByDate, normalizeMatchStatus, type RawMatch } from "@/lib/nba/client";
import { nyDateString } from "@/lib/dates/newyork";

// Writer de /api/sync/schedule (SPEC_TECHNIQUE_SYNCHRO_V0.1 §5/§6, correctif
// post-validation §5.2/§12 — voir la discussion tenue avec l'utilisateur le
// 28/07/2026). Deux chemins :
// - match DÉJÀ connu (entity_mappings MATCH) : met à jour scheduled_at/statut
//   (idempotent, jamais de doublon).
// - match JAMAIS vu : l'attache à sa série se réduit à une recherche
//   DÉTERMINISTE (pas une heuristique floue) — series.team1_id/team2_id sont
//   TOUJOURS déjà connus avant qu'un match de cette série soit joué (saisis à
//   la création du bracket ou posés par advanceWinnerIfDecided), donc une
//   paire d'équipes ne peut être active que dans UNE série à la fois au sein
//   de la compétition ACTIVE. Le cas 0/2+ candidates (ne devrait
//   structurellement jamais arriver) est juste IGNORÉ pour cette passe et
//   journalisé par l'appelant (route) dans sync_logs — décision actée avec
//   l'utilisateur : pas de mécanisme PENDING/écran de revue (entity_mappings.
//   internal_id est NOT NULL, un match jamais vu n'a justement AUCUNE ligne
//   interne à pointer ; aucun écran de ce type n'a jamais été spécifié, voir
//   GAPS_OUVERTS.md).

const SYNC_HORIZON_DAYS = 4; // §12.5 : fenêtre 3 j de pronos + 1 j de marge.
const LOCKED_SERIES_STATUSES = new Set(["FINISHED", "CANCELLED"]);

type SeriesRow = {
  id: string;
  competition_id: string;
  team1_id: string | null;
  team2_id: string | null;
  official_status: string;
};

export type SkippedMatch = { highlightlyMatchId: number; reason: string };

export type SyncScheduleResult = {
  updated: number;
  created: number;
  skipped: SkippedMatch[];
  requestsRemaining: number | null;
};

function horizonDates(referenceDate: Date, days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(referenceDate.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(nyDateString(d)); // jour calendaire America/New_York, pas UTC (voir lib/dates/newyork.ts).
  }
  return dates;
}

function findCandidateSeries(series: SeriesRow[], homeTeamId: string, awayTeamId: string): SeriesRow[] {
  if (homeTeamId === awayTeamId) return [];
  return series.filter((s) => {
    if (LOCKED_SERIES_STATUSES.has(s.official_status)) return false;
    if (!s.team1_id || !s.team2_id) return false;
    const pair = new Set([s.team1_id, s.team2_id]);
    return pair.has(homeTeamId) && pair.has(awayTeamId);
  });
}

/** `referenceDate` : "aujourd'hui" en production (le planificateur externe
 *  n'envoie jamais ce paramètre) — override réservé au dev/test, pour rejouer
 *  le pipeline sur une VRAIE fenêtre de playoffs passée tant qu'on est hors
 *  saison (convenu avec l'utilisateur le 28/07/2026, voir la route). */
export async function syncSchedule(referenceDate: Date = new Date()): Promise<SyncScheduleResult> {
  const supabase = getServiceClient();
  const result: SyncScheduleResult = { updated: 0, created: 0, skipped: [], requestsRemaining: null };

  const { data: activeCompetition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (!activeCompetition) return result; // rien à attacher sans compétition active.

  const allMatches: RawMatch[] = [];
  for (const date of horizonDates(referenceDate, SYNC_HORIZON_DAYS)) {
    const { data, requestsRemaining } = await getMatchesByDate(date);
    allMatches.push(...data);
    result.requestsRemaining = requestsRemaining;
  }

  const [{ data: teamMapData }, { data: matchMapData }, { data: seriesData }] = await Promise.all([
    supabase.from("entity_mappings").select("internal_id, source_ref").eq("entity_type", "TEAM").eq("source_type", "HIGHLIGHTLY"),
    supabase.from("entity_mappings").select("internal_id, source_ref").eq("entity_type", "MATCH").eq("source_type", "HIGHLIGHTLY"),
    supabase.from("series").select("id, competition_id, team1_id, team2_id, official_status").eq("competition_id", activeCompetition.id),
  ]);

  const teamInternalIdBySourceRef = new Map<string, string>(
    (teamMapData ?? []).map((r) => [r.source_ref as string, r.internal_id as string])
  );
  const matchInternalIdBySourceRef = new Map<string, string>(
    (matchMapData ?? []).map((r) => [r.source_ref as string, r.internal_id as string])
  );
  const allSeries = (seriesData ?? []) as SeriesRow[];

  const { data: matchCountData } = await supabase
    .from("matches")
    .select("series_id")
    .in("series_id", allSeries.map((s) => s.id));
  const matchCountBySeries = new Map<string, number>();
  for (const row of matchCountData ?? []) {
    const seriesId = row.series_id as string;
    matchCountBySeries.set(seriesId, (matchCountBySeries.get(seriesId) ?? 0) + 1);
  }

  for (const match of allMatches) {
    const sourceRef = String(match.id);
    const status = normalizeMatchStatus(match.state.description).status;
    const existingInternalId = matchInternalIdBySourceRef.get(sourceRef);

    if (existingInternalId) {
      const { error } = await supabase
        .from("matches")
        .update({ scheduled_at: match.date, status })
        .eq("id", existingInternalId);
      if (!error) result.updated++;
      continue;
    }

    const homeTeamId = teamInternalIdBySourceRef.get(String(match.homeTeam.id));
    const awayTeamId = teamInternalIdBySourceRef.get(String(match.awayTeam.id));
    if (!homeTeamId || !awayTeamId) {
      result.skipped.push({ highlightlyMatchId: match.id, reason: "équipe non mappée (pas une des 30 franchises)" });
      continue;
    }

    const candidates = findCandidateSeries(allSeries, homeTeamId, awayTeamId);
    if (candidates.length !== 1) {
      result.skipped.push({
        highlightlyMatchId: match.id,
        reason: candidates.length === 0 ? "aucune série candidate" : `${candidates.length} séries candidates`,
      });
      continue;
    }

    const series = candidates[0];
    const gameNumber = (matchCountBySeries.get(series.id) ?? 0) + 1;
    if (gameNumber > 7) {
      result.skipped.push({ highlightlyMatchId: match.id, reason: "série déjà à 7 matchs" });
      continue;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("matches")
      .insert({
        competition_id: series.competition_id,
        series_id: series.id,
        game_number: gameNumber,
        scheduled_at: match.date,
        status,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      })
      .select("id")
      .single<{ id: string }>();
    if (insertErr || !inserted) {
      result.skipped.push({ highlightlyMatchId: match.id, reason: `échec insertion : ${insertErr?.message}` });
      continue;
    }

    await supabase.from("entity_mappings").upsert(
      {
        entity_type: "MATCH",
        internal_id: inserted.id,
        source_type: "HIGHLIGHTLY",
        source_ref: sourceRef,
        status: "CONFIRMED",
        confirmed_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,internal_id,source_type" }
    );

    matchInternalIdBySourceRef.set(sourceRef, inserted.id); // évite un doublon si le même match reparaît sur 2 dates de l'horizon
    matchCountBySeries.set(series.id, gameNumber);
    result.created++;
  }

  return result;
}
