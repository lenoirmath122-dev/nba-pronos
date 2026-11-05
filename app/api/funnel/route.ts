import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkAnonRateLimit } from "@/lib/auth/anonRateLimit";
import { detectInAppBrowser } from "@/lib/auth/inAppBrowser";
import { INTERNAL_COOKIE, isBotUserAgent, parseFunnelPayload } from "@/lib/funnel/events";
import { funnelWritesEnabled, insertFunnelEvent } from "@/lib/funnel/record";

// Mesure d'audience interne et anonyme (plan d'attractivité, §1.13). Jamais
// bloquant pour le visiteur : toute erreur répond 204. Le limiteur est
// fail-closed ; il protège la table contre un remplissage par un seul client.
// Rien n'est écrit hors production, pour un robot ou pour un admin. Le
// User-Agent sert à deviner la famille du navigateur et n'est jamais stocké.
export const runtime = "nodejs";

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  if (!funnelWritesEnabled()) return noContent();
  const userAgent = request.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) return noContent();
  if ((await cookies()).get(INTERNAL_COOKIE)) return noContent();

  const payload = parseFunnelPayload(await request.json().catch(() => null));
  if (!payload) return noContent();
  if (!(await checkAnonRateLimit("funnel", 120, 3600))) return noContent();

  await insertFunnelEvent({ ...payload, inAppBrowser: detectInAppBrowser(userAgent) });
  return noContent();
}
