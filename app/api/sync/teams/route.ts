import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";
import { syncTeams } from "@/lib/sync/teams";
import { HighlightlyApiError } from "@/lib/nba/client";

// SPEC_TECHNIQUE_SYNCHRO_V0.1 §6 : runtime Node, service_role (contourne la
// RLS), authentifiée par Bearer SYNC_SECRET. Déclenchée à la demande (rare —
// référentiel équipes fixe, §4), jamais par le planificateur régulier.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = getServiceClient();

  try {
    const result = await syncTeams();
    const summary =
      `${result.mapped} équipe(s) mappée(s).` +
      (result.missingFromApi.length > 0 ? ` Absentes de l'API à cet appel : ${result.missingFromApi.join(", ")}.` : "");
    await writeSyncLog(supabase, {
      syncType: "TEAMS",
      endpoint: "/teams",
      success: true,
      summary,
      requestsRemaining: result.requestsRemaining,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof HighlightlyApiError || error instanceof Error ? error.message : "Erreur inconnue.";
    await writeSyncLog(supabase, {
      syncType: "TEAMS",
      endpoint: "/teams",
      success: false,
      summary: message,
      requestsRemaining: null,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
