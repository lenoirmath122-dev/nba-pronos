import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { TEAM_INSIGHTS_TAG } from "@/lib/queries/teamInsights";

// Appelée par la VM (refresh_job.py) après le rafraîchissement de
// stats_team_form / stats_player_season. Même garde que /api/resolve-bets.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  revalidateTag(TEAM_INSIGHTS_TAG, "max");
  return NextResponse.json({ revalidated: true });
}
