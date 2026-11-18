import "server-only";
import { COMMON_TAGS, invalidateCommonData } from "@/lib/cache/commonData";
import { nyDateString } from "@/lib/dates/newyork";
import { resolveAllCalculableBets } from "@/lib/ai/resolveCalculableBets";
import { sendPushToAdmins } from "@/lib/push/admins";
import { getServiceClient } from "@/lib/supabase/service";
import { writeSyncLog } from "@/lib/sync/logging";
import { syncResults } from "@/lib/sync/results";
import { buildGuardPush, isOpenStatus, lateWindow, type GuardMatch, type GuardPush } from "@/lib/sync/resultsGuardRules";

// Garde « match sans score » (cron Vercel horaire, matinée Paris) : voir
// lib/sync/resultsGuardRules.ts pour le contexte et les seuils.
// 1. Cherche les matchs d'une compétition ACTIVE encore SCHEDULED / IN_PROGRESS
//    3 h 30 à 36 h après leur coup d'envoi.
// 2. En trouve : relance le repli Highlightly (syncResults) sur leur(s) jour(s) NY.
//    Highlightly écrit le score dès que le statut change, même sur un match suivi
//    par le poller NBA (highlightlyMayWrite) : c'est exactement le cas « VM muette ».
// 3. Prévient les admins par push : score rattrapé (VM à regarder) ou toujours absent.
// Aucun appel Highlightly quand tout va bien (pas de match en retard).

export type GuardResult = {
  late: number;
  healed: number;
  stillLate: number;
  syncErrors: string[];
  push: GuardPush | null;
  pushed: boolean;
  dryRun: boolean;
};

const MATCH_COLUMNS = "id, status, scheduled_at, home_team_id, away_team_id";

export async function runResultsGuard(now: Date = new Date(), options: { dryRun?: boolean } = {}): Promise<GuardResult> {
  const dryRun = options.dryRun === true;
  const supabase = getServiceClient();
  const result: GuardResult = { late: 0, healed: 0, stillLate: 0, syncErrors: [], push: null, pushed: false, dryRun };

  const { data: competitions, error: competitionsError } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE");
  if (competitionsError) throw new Error(`competitions : ${competitionsError.message}`);
  const competitionIds = (competitions ?? []).map((c) => c.id as string);
  if (competitionIds.length === 0) return result;

  const { from, to } = lateWindow(now);
  const { data: lateData, error: lateError } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .in("competition_id", competitionIds)
    .in("status", ["SCHEDULED", "IN_PROGRESS"])
    .gte("scheduled_at", from)
    .lte("scheduled_at", to);
  if (lateError) throw new Error(`matches : ${lateError.message}`);
  const late = (lateData ?? []) as GuardMatch[];
  result.late = late.length;
  if (late.length === 0 || dryRun) return result;

  // Repli Highlightly, une passe par jour NY concerné (le plus souvent un seul).
  const referenceByNyDate = new Map<string, Date>();
  for (const match of late) {
    const instant = new Date(match.scheduled_at);
    referenceByNyDate.set(nyDateString(instant), instant);
  }
  let finishedNow = 0;
  for (const [nyDate, reference] of referenceByNyDate) {
    try {
      const sync = await syncResults(reference);
      finishedNow += sync.finishedNow.length;
      await writeSyncLog(supabase, {
        syncType: "RESULTS",
        endpoint: "/matches (garde)",
        success: true,
        summary: `Garde match sans score (${nyDate}) : ${sync.changed} changé(s), ${sync.finishedNow.length} terminé(s).`,
        requestsRemaining: sync.requestsRemaining,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue.";
      result.syncErrors.push(`${nyDate} : ${message}`);
      await writeSyncLog(supabase, {
        syncType: "RESULTS",
        endpoint: "/matches (garde)",
        success: false,
        summary: `Garde match sans score (${nyDate}) : ${message}`,
        requestsRemaining: null,
      });
    }
  }
  invalidateCommonData(COMMON_TAGS.matches, COMMON_TAGS.series);
  if (finishedNow > 0) {
    try {
      await resolveAllCalculableBets();
    } catch (error) {
      console.error("results-guard : résolution des paris échouée", error);
    }
  }

  // Relecture : qui a été rattrapé, qui manque encore.
  const { data: afterData, error: afterError } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .in(
      "id",
      late.map((m) => m.id),
    );
  if (afterError) throw new Error(`matches (relecture) : ${afterError.message}`);
  const statusById = new Map(((afterData ?? []) as GuardMatch[]).map((m) => [m.id, m.status]));
  const healed = late.filter((m) => !isOpenStatus(statusById.get(m.id) ?? m.status));
  const stillLate = late.filter((m) => isOpenStatus(statusById.get(m.id) ?? m.status));
  result.healed = healed.length;
  result.stillLate = stillLate.length;

  const teamIds = [...new Set(late.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((id): id is string => !!id))];
  const { data: teams } = teamIds.length
    ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds)
    : { data: [] as { id: string; abbreviation: string }[] };
  const abbreviations = new Map((teams ?? []).map((t) => [t.id as string, t.abbreviation as string]));

  result.push = buildGuardPush(healed, stillLate, abbreviations, now);
  if (result.push) {
    const sent = await sendPushToAdmins(result.push, { ttlSeconds: 6 * 3600 });
    result.pushed = sent.ok;
  }
  return result;
}
