import {
  INTERNAL_COOKIE,
  UTM_COOKIE,
  VISITOR_COOKIE,
  VISIT_DAY_KEY,
  parisDay,
  parseUtmCookie,
  serializeUtm,
  utmFromSearch,
  type FunnelEvent,
} from "./events";

// Côté navigateur : identifiant de visiteur aléatoire (sans donnée personnelle),
// source de la visite (UTM, 30 jours) et envoi d'un événement sans attendre la
// réponse.
//
// pb_vid est posé par le SERVEUR (réponse de /api/funnel), pas ici : Safari et
// tous les navigateurs iOS (dont celui d'Instagram) limitent à 7 jours un cookie
// écrit en JavaScript, ce qui recompterait chaque iPhone comme un nouveau
// visiteur toutes les semaines. Tant que le cookie n'existe pas encore, on
// envoie un identifiant gardé en mémoire, que le serveur reprend dans son cookie.

function readCookie(name: string): string | undefined {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

let pendingVisitorId: string | null = null;

function visitorId(): string | null {
  try {
    const existing = readCookie(VISITOR_COOKIE);
    if (existing) return existing;
    pendingVisitorId ??= crypto.randomUUID();
    return pendingVisitorId;
  } catch {
    return null;
  }
}

/** Navigateur marqué admin (cookie pb_internal posé par le hub admin) : rien n'est mesuré. */
export function isInternalVisitor(): boolean {
  try {
    return Boolean(readCookie(INTERNAL_COOKIE));
  } catch {
    return false;
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
    if (isInternalVisitor()) return;
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

/**
 * Une « visit » par navigateur et par jour (heure de Paris), quelle que soit la page :
 * c'est ce qui permet de compter les visiteurs uniques sur 7 ou 30 jours.
 */
export function trackDailyVisit(): void {
  try {
    if (isInternalVisitor()) return;
    const today = parisDay();
    if (localStorage.getItem(VISIT_DAY_KEY) === today) return;
    localStorage.setItem(VISIT_DAY_KEY, today);
  } catch {
    // localStorage indisponible : on envoie quand même, le décompte reste par visiteur distinct.
  }
  trackFunnel("visit");
}
