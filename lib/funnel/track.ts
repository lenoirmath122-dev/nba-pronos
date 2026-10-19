import { VISITOR_COOKIE, type FunnelEvent } from "./events";

// Côté navigateur : identifiant de visiteur aléatoire en cookie (1 an, sans
// donnée personnelle) et envoi d'un événement sans attendre la réponse.

function visitorId(): string | null {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${VISITOR_COOKIE}=`));
    if (hit) return hit.slice(VISITOR_COOKIE.length + 1);
    const id = crypto.randomUUID();
    document.cookie = `${VISITOR_COOKIE}=${id}; Max-Age=31536000; Path=/; SameSite=Lax`;
    return id;
  } catch {
    return null;
  }
}

export function trackFunnel(event: FunnelEvent, matchId?: string): void {
  try {
    const id = visitorId();
    if (!id) return;
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId: id, event, matchId: matchId ?? null, referrer: document.referrer || null }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Mesure facultative : jamais d'erreur visible.
  }
}
