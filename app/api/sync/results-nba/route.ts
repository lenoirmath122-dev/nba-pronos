import { after, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { writeSyncLog } from "@/lib/sync/logging";
import { syncResultsFromNba } from "@/lib/sync/resultsNba";
import { nbaLivePayloadSchema } from "@/lib/nba/nbaLive";
import { resolveAllCalculableBets } from "@/lib/ai/resolveCalculableBets";
import { toClientError } from "@/lib/actions/errors";

// Résultats poussés par la VM depuis l'API NBA (poll_results.py, ou le secours
// de l'import des box scores). Le corps est un sous-ensemble quasi brut du JSON
// NBA ; la normalisation et le rapprochement vivent dans lib/nba/nbaLive.ts et
// lib/sync/resultsNba.ts. Idempotent : renvoyer deux fois le même corps ne
// change rien. Bearer SYNC_SECRET comme les autres routes /api/sync/*.
export const runtime = "nodejs";
// after() (résolution des paris) vit dans la durée de la fonction.
export const maxDuration = 60;

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Corps trop volumineux." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Corps trop volumineux." }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }
  const parsed = nbaLivePayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps invalide.", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const payload = parsed.data;
  const supabase = getServiceClient();
  const endpoint = `nba:${payload.source}`;

  try {
    const result = await syncResultsFromNba(payload);
    // Pas une ligne par passage (~480/jour) : seulement s'il s'est passé quelque chose.
    if (result.changed > 0 || result.skipped.length > 0) {
      const summary =
        `${result.dryRun ? "[dryRun] " : ""}${result.changed} changé(s), ${result.unchanged} inchangé(s), ${result.unmapped} non mappé(s).` +
        (result.skipped.length > 0 ? ` Ignorés : ${result.skipped.map((s) => `${s.gameId} (${s.reason})`).join("; ")}.` : "");
      await writeSyncLog(supabase, { syncType: "RESULTS", endpoint, success: true, summary, requestsRemaining: null });
    }
    if (result.finishedNow.length > 0) {
      after(async () => {
        try {
          await resolveAllCalculableBets();
        } catch (error) {
          console.error("sync/results-nba : résolution des paris échouée", error);
        }
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    await writeSyncLog(supabase, { syncType: "RESULTS", endpoint, success: false, summary: message, requestsRemaining: null });
    return NextResponse.json({ error: toClientError("sync/results-nba", { message }) }, { status: 502 });
  }
}
