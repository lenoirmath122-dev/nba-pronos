import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";
import { syncSchedule } from "@/lib/sync/schedule";
import { resolveReferenceDate } from "@/lib/sync/devDateOverride";
import { HighlightlyApiError } from "@/lib/nba/client";

// SPEC_TECHNIQUE_SYNCHRO_V0.1 §6 : 1×/jour en production, runtime Node,
// service_role, Bearer SYNC_SECRET. `?date=YYYY-MM-DD` : override DEV/TEST
// UNIQUEMENT (lib/sync/devDateOverride.ts) — jamais envoyé par le vrai
// planificateur externe.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = getServiceClient();
  const dateParam = new URL(request.url).searchParams.get("date");
  const referenceDate = resolveReferenceDate(dateParam);

  try {
    const result = await syncSchedule(referenceDate);
    const summary =
      `${result.created} créé(s), ${result.updated} mis à jour.` +
      (result.skipped.length > 0
        ? ` Ignorés : ${result.skipped.map((s) => `#${s.highlightlyMatchId} (${s.reason})`).join("; ")}.`
        : "");
    await writeSyncLog(supabase, {
      syncType: "SCHEDULE",
      endpoint: "/matches",
      success: true,
      summary,
      requestsRemaining: result.requestsRemaining,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof HighlightlyApiError || error instanceof Error ? error.message : "Erreur inconnue.";
    await writeSyncLog(supabase, {
      syncType: "SCHEDULE",
      endpoint: "/matches",
      success: false,
      summary: message,
      requestsRemaining: null,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
