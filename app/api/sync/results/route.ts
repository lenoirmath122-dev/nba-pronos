import { after, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";
import { syncResults } from "@/lib/sync/results";
import { resolveReferenceDate } from "@/lib/sync/devDateOverride";
import { HighlightlyApiError } from "@/lib/nba/client";
import { toClientError } from "@/lib/actions/errors";
import { resolveAllCalculableBets } from "@/lib/ai/resolveCalculableBets";

// SPEC_TECHNIQUE_SYNCHRO_V0.1 §6 : 30-60 min en fenêtre de match en
// production (config du planificateur externe, pas du code), runtime Node,
// service_role, Bearer SYNC_SECRET. `?date=YYYY-MM-DD` : override DEV/TEST
// UNIQUEMENT (lib/sync/devDateOverride.ts).
export const runtime = "nodejs";
// after() (résolution des paris) vit dans la durée de la fonction.
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = getServiceClient();
  const dateParam = new URL(request.url).searchParams.get("date");
  const referenceDate = resolveReferenceDate(dateParam);

  try {
    const result = await syncResults(referenceDate);
    const summary =
      `${result.changed} changé(s), ${result.unchanged} inchangé(s).` +
      (result.skipped.length > 0
        ? ` Ignorés : ${result.skipped.map((s) => `#${s.highlightlyMatchId} (${s.reason})`).join("; ")}.`
        : "") +
      (result.notDrawn > 0 ? ` ${result.notDrawn} match(s) non tiré(s) ignoré(s) (Match du jour).` : "") +
      (result.deferredToNba > 0 ? ` ${result.deferredToNba} match(s) laissé(s) au poller NBA.` : "") +
      (result.failedDates.length > 0
        ? ` Dates en échec : ${result.failedDates.map((f) => `${f.date} (${f.message})`).join("; ")}.`
        : "") +
      (result.unrecognizedStatuses.length > 0
        ? ` Statuts Highlightly non reconnus (retombés sur IN_PROGRESS) : ${result.unrecognizedStatuses
            .map((s) => `#${s.highlightlyMatchId} ("${s.description}")`)
            .join("; ")}.`
        : "");
    await writeSyncLog(supabase, {
      syncType: "RESULTS",
      endpoint: "/matches",
      success: true,
      summary,
      requestsRemaining: result.requestsRemaining,
    });
    // Un match vient de passer FINISHED : on résout tout de suite les paris
    // calculables (ceux qui lisent les box scores restent ignorés tant que
    // l'import de la VM n'est pas passé, voir resolveNbaGameId).
    if (result.finishedNow.length > 0) {
      after(async () => {
        try {
          await resolveAllCalculableBets();
        } catch (error) {
          console.error("sync/results : résolution des paris échouée", error);
        }
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof HighlightlyApiError || error instanceof Error ? error.message : "Erreur inconnue.";
    await writeSyncLog(supabase, {
      syncType: "RESULTS",
      endpoint: "/matches",
      success: false,
      summary: message,
      requestsRemaining: null,
    });
    // Détail complet déjà conservé dans sync_logs (admin-only) ci-dessus —
    // la réponse HTTP, elle, reste générique (audit sécurité, finding 13).
    return NextResponse.json({ error: toClientError("sync/results", { message }) }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
