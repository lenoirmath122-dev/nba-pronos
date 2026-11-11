import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkAnonRateLimit } from "@/lib/auth/anonRateLimit";
import { detectInAppBrowser } from "@/lib/auth/inAppBrowser";
import {
  INTERNAL_COOKIE,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
  isBotUserAgent,
  parseFunnelPayload,
} from "@/lib/funnel/events";
import { funnelWritesEnabled, insertFunnelEvent } from "@/lib/funnel/record";

// Mesure d'audience interne et anonyme (plan d'attractivité, §1.13). Jamais
// bloquant pour le visiteur : toute erreur répond 204. Le limiteur est
// fail-closed ; il protège la table contre un remplissage par un seul client.
// Rien n'est écrit hors production, pour un robot ou pour un admin. Le
// User-Agent sert à deviner la famille du navigateur et n'est jamais stocké.
// C'est aussi ici que naît le cookie pb_vid (voir lib/funnel/track.ts) : posé
// par le serveur une seule fois, à la première mesure, et jamais prolongé.
export const runtime = "nodejs";

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request): Promise<Response> {
  if (!funnelWritesEnabled()) return noContent();
  const userAgent = request.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) return noContent();
  const store = await cookies();
  if (store.get(INTERNAL_COOKIE)) return noContent();

  const payload = parseFunnelPayload(await request.json().catch(() => null));
  if (!payload) return noContent();

  const response = noContent();
  if (!store.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, payload.visitorId, {
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: false, // relu par le navigateur pour les événements suivants
    });
  }
  if (!(await checkAnonRateLimit("funnel", 120, 3600))) return response;

  await insertFunnelEvent({ ...payload, inAppBrowser: detectInAppBrowser(userAgent) });
  return response;
}
