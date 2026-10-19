import { NextResponse } from "next/server";
import { checkAnonRateLimit } from "@/lib/auth/anonRateLimit";
import { getServiceClient } from "@/lib/supabase/service";
import { parseFunnelPayload } from "@/lib/funnel/events";

// Mesure d'audience interne et anonyme (plan d'attractivité, §1.13). Jamais
// bloquant pour le visiteur : toute erreur répond 204. Le limiteur est
// fail-closed ; il protège la table contre un remplissage par un seul client.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const payload = parseFunnelPayload(await request.json().catch(() => null));
  if (!payload) return new NextResponse(null, { status: 204 });
  if (!(await checkAnonRateLimit("funnel", 120, 3600))) return new NextResponse(null, { status: 204 });

  const { error } = await getServiceClient().from("funnel_events").insert({
    visitor_id: payload.visitorId,
    event: payload.event,
    match_id: payload.matchId,
    referrer: payload.referrer,
  });
  if (error) console.error(`funnel_events : insertion en échec — ${error.message}`);
  return new NextResponse(null, { status: 204 });
}
