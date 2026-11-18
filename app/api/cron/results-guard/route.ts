import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runResultsGuard } from "@/lib/sync/resultsGuard";

// Garde « match sans score » (cron Vercel horaire de 4 h à 12 h UTC, voir
// vercel.json) : un match encore ouvert 3 h 30 après son coup d'envoi relance le
// repli Highlightly, puis push aux admins (lib/sync/resultsGuard.ts).
// `?dry_run=1` : compte les matchs en retard sans appeler Highlightly ni envoyer de push.
// Garde d'authentification : Bearer SYNC_SECRET ou CRON_SECRET (cron Vercel).
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dry_run") === "1";
  try {
    return NextResponse.json(await runResultsGuard(new Date(), { dryRun }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("results-guard :", message);
    return NextResponse.json({ error: "Garde des résultats en échec." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
