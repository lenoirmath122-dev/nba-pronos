import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runLeaderboardSnapshot } from "@/lib/snapshots/leaderboardSnapshot";

// Snapshot quotidien du classement (BACKLOG_V1.md « Fun / esprit ligue entre
// potes »). Le figement automatique passe par /api/recaps (cron Vercel) ; cette
// route sert au déclenchement manuel et au secours GitHub Actions. Bearer
// SYNC_SECRET ou CRON_SECRET, service_role.
//
// Un jour déjà figé n'est jamais réécrit. `?force=1` ne lève que la garde des
// 10h Paris : forcer AVANT 10h fige le jour trop tôt, sans retour possible
// (sauf DELETE à la main sur leaderboard_snapshots).
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await runLeaderboardSnapshot(Date.now(), { force });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
