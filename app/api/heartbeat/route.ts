import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";

// SPEC_TECHNIQUE_SYNCHRO_V0.1 §6 : ping DB léger anti-pause Supabase, actif
// TOUTE L'ANNÉE (A8) — AUCUN appel à l'API Highlightly, jamais de quota
// consommé. Bearer SYNC_SECRET comme les 3 autres jobs.
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from("teams").select("id", { count: "exact", head: true });

  await writeSyncLog(supabase, {
    syncType: "HEARTBEAT",
    endpoint: null,
    success: !error,
    summary: error ? error.message : "ping OK",
    requestsRemaining: null,
  });

  return NextResponse.json({ ok: !error });
}
