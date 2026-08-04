import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";

// SPEC_TECHNIQUE_SYNCHRO_V0.1 §6 : ping DB léger anti-pause Supabase, actif
// TOUTE L'ANNÉE (A8) — AUCUN appel à l'API Highlightly, jamais de quota
// consommé. Bearer SYNC_SECRET comme les 3 autres jobs.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
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

// GET *et* POST (bug corrigé le 04/08/2026) : le workflow GitHub Actions
// appelle en POST, comme les 6 autres jobs planifiés (sync/reminders/
// snapshot) — cette route n'exportait QUE GET, donc le heartbeat échouait en
// 405 à CHAQUE exécution depuis sa création, silencieusement (personne ne
// consultait l'onglet Actions), jusqu'à la mise en pause réelle du projet
// Supabase après 7 jours. Cause racine du ticket du 04/08/2026, pas juste
// une automatisation manquante.
export const GET = handle;
export const POST = handle;
