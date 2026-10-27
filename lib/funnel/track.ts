import {
  INTERNAL_COOKIE,
  UTM_COOKIE,
  VISITOR_COOKIE,
  parseUtmCookie,
  serializeUtm,
  utmFromSearch,
  type FunnelEvent,
} from "./events";

// Côté navigateur : identifiant de visiteur aléatoire en cookie (1 an, sans
// donnée personnelle), source de la visite (UTM, 30 jours) et envoi d'un
// événement sans attendre la réponse.

function readCookie(name: string): string | undefined {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

function visitorId(): string | null {
  try {
    const existing = readCookie(VISITOR_COOKIE);
    if (existing) return existing;
    const id = crypto.randomUUID();
    document.cookie = `${VISITOR_COOKIE}=${id}; Max-Age=31536000; Path=/; SameSite=Lax`;
    return id;
  } catch {
    return null;
  }
}

/**
 * Garde les utm_* de l'URL d'arrivée dans le cookie pb_utm. Un lien avec UTM
 * remplace les anciens ; un lien sans UTM ne les efface pas.
 */
export function captureUtm(): void {
  try {
    const utm = utmFromSearch(window.location.search);
    if (!utm) return;
    const value = serializeUtm(utm);
    if (value) document.cookie = `${UTM_COOKIE}=${value}; Max-Age=2592000; Path=/; SameSite=Lax`;
  } catch {
    // Mesure facultative.
  }
}

export function trackFunnel(event: FunnelEvent, matchId?: string): void {
  try {
    if (readCookie(INTERNAL_COOKIE)) return;
    captureUtm();
    const id = visitorId();
    if (!id) return;
    void fetch("/api/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visitorId: id,
        event,
        matchId: matchId ?? null,
        referrer: document.referrer || null,
        utm: parseUtmCookie(readCookie(UTM_COOKIE)),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Mesure facultative : jamais d'erreur visible.
  }
}
