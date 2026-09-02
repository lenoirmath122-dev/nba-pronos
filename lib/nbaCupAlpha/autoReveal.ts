import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeMatch } from "@/lib/scoring/recompute";
import { advanceWinnerIfDecided } from "@/lib/scoring/advancement";
import { resolveAllCalculableBets } from "@/lib/ai/resolveCalculableBets";

// Automatise scripts/nba-cup-reveal-match.mjs (chantier "NBA Cup — Alpha
// Potes", GAPS_OUVERTS.md, 27-28/08/2026) : au lieu de lancer le script à la
// main le jour J, cette fonction tourne en cron (route /api/nba-cup-alpha/
// auto-reveal, même patron que /api/sync/results) et révèle toute seule un
// match fictif dès que son scheduled_at est passé -- pour se comporter
// "comme en bêta", où /api/sync/results détecte tout seul qu'un vrai match
// Highlightly est FINISHED.
//
// Repérage UNIQUEMENT via entity_mappings.source_type = 'NBA_API' -- réservé
// à ce mécanisme d'emprunt alpha (les vraies synchros utilisent
// source_type = 'HIGHLIGHTLY', lib/sync/results.ts), donc ce cron ne touche
// jamais un match synchronisé normalement. Mécanisme propre à l'alpha, à NE
// PAS réutiliser pour la bêta (même mise en garde que nba-cup-create-match.mjs
// / GAPS_OUVERTS.md) -- la bêta suivra un vrai calendrier NBA Cup synchronisé
// normalement, sans emprunt ni entity_mappings de ce type.
//
// Contrairement au script manuel original (Node autonome, ne peut pas
// importer de module "server-only"), tourne DANS Next.js -- appelle donc
// directement recomputeMatch/advanceWinnerIfDecided plutôt que de
// réimplémenter leur orchestration.
//
// Résolution des paris personnalisés IA chaînée directement après (pas
// besoin d'attendre le cron quotidien comme le scénario normal, cf.
// resolveAllCalculableBets) : les stats empruntées à l'alpha sont des
// matchs NBA historiques déjà entièrement en base, contrairement aux stats
// "de la veille" du scénario réel qui n'arrivent qu'au rafraîchissement
// Data NBA quotidien (refresh-stats-supabase.yml, 10h UTC).

type SupabaseServiceClient = ReturnType<typeof getServiceClient>;

type DueMatchRow = {
  id: string;
  series_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
};

export type RevealedAlphaMatch = {
  matchId: string;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  realGameId: string;
};

export type SkippedAlphaMatch = { matchId: string; reason: string };

export type AutoRevealAlphaResult = {
  revealed: RevealedAlphaMatch[];
  skipped: SkippedAlphaMatch[];
  betsResolved: number;
};

/** `referenceDate` : "maintenant" en production -- override dev/test,
 *  même convention que lib/sync/devDateOverride.ts. */
export async function autoRevealAlphaMatches(referenceDate: Date = new Date()): Promise<AutoRevealAlphaResult> {
  const supabase = getServiceClient();
  const result: AutoRevealAlphaResult = { revealed: [], skipped: [], betsResolved: 0 };

  const { data: mappingsData } = await supabase
    .from("entity_mappings")
    .select("internal_id, source_ref")
    .eq("entity_type", "MATCH")
    .eq("source_type", "NBA_API");
  const mappingRows = (mappingsData ?? []) as { internal_id: string; source_ref: string }[];
  if (mappingRows.length === 0) return result;

  const internalIds = mappingRows.map((m) => m.internal_id);
  const { data: dueMatchesData } = await supabase
    .from("matches")
    .select("id, series_id, home_team_id, away_team_id")
    .in("id", internalIds)
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", referenceDate.toISOString());
  const dueMatches = (dueMatchesData ?? []) as DueMatchRow[];
  if (dueMatches.length === 0) return result;

  for (const match of dueMatches) {
    await revealOneMatch(supabase, match, mappingRows, result);
  }

  if (result.revealed.length > 0) {
    const betsSummary = await resolveAllCalculableBets();
    result.betsResolved = betsSummary.resolved.length;
  }

  return result;
}

async function revealOneMatch(
  supabase: SupabaseServiceClient,
  match: DueMatchRow,
  mappingRows: { internal_id: string; source_ref: string }[],
  result: AutoRevealAlphaResult
): Promise<void> {
  const realGameId = mappingRows.find((m) => m.internal_id === match.id)?.source_ref;
  if (!realGameId) {
    result.skipped.push({ matchId: match.id, reason: "entity_mappings introuvable (ne devrait jamais arriver)" });
    return;
  }
  if (!match.home_team_id || !match.away_team_id) {
    result.skipped.push({ matchId: match.id, reason: "équipe(s) manquante(s) sur le match" });
    return;
  }

  const { data: appTeamsData } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", [match.home_team_id, match.away_team_id]);
  const abbrById = new Map(((appTeamsData ?? []) as { id: string; abbreviation: string }[]).map((t) => [t.id, t.abbreviation]));
  const homeAbbr = abbrById.get(match.home_team_id);
  const awayAbbr = abbrById.get(match.away_team_id);
  if (!homeAbbr || !awayAbbr) {
    result.skipped.push({ matchId: match.id, reason: "équipe(s) introuvable(s) dans teams" });
    return;
  }

  const { data: statsTeamsData } = await supabase
    .from("stats_equipes")
    .select("team_id, tricode")
    .in("tricode", [homeAbbr, awayAbbr]);
  const nbaIdByTricode = new Map(((statsTeamsData ?? []) as { team_id: string; tricode: string }[]).map((t) => [t.tricode, t.team_id]));
  const homeNbaId = nbaIdByTricode.get(homeAbbr);
  const awayNbaId = nbaIdByTricode.get(awayAbbr);
  if (homeNbaId === undefined || awayNbaId === undefined) {
    result.skipped.push({ matchId: match.id, reason: `tricode(s) ${homeAbbr}/${awayAbbr} introuvable(s) dans stats_equipes` });
    return;
  }

  const { data: boxRowsData } = await supabase
    .from("stats_box_scores")
    .select("team_id, pts")
    .eq("game_id", realGameId)
    .in("team_id", [homeNbaId, awayNbaId]);
  const scoreByTeam = new Map<string, number>();
  for (const row of (boxRowsData ?? []) as { team_id: string | null; pts: number | null }[]) {
    if (row.team_id === null || row.pts === null) continue;
    scoreByTeam.set(row.team_id, (scoreByTeam.get(row.team_id) ?? 0) + row.pts);
  }
  const homeScore = scoreByTeam.get(homeNbaId) ?? null;
  const awayScore = scoreByTeam.get(awayNbaId) ?? null;
  if (homeScore === null || awayScore === null) {
    result.skipped.push({ matchId: match.id, reason: `stats_box_scores incomplètes pour le match réel ${realGameId}` });
    return;
  }

  const { error: updateError } = await supabase
    .from("matches")
    .update({ status: "FINISHED", home_score: homeScore, away_score: awayScore })
    .eq("id", match.id);
  if (updateError) {
    result.skipped.push({ matchId: match.id, reason: `échec update : ${updateError.message}` });
    return;
  }

  await recomputeMatch(match.id);
  await advanceWinnerIfDecided(match.series_id);

  result.revealed.push({ matchId: match.id, homeAbbr, awayAbbr, homeScore, awayScore, realGameId });
}
