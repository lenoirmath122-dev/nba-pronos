// Événements de l'entonnoir de l'accueil (plan d'attractivité, §1.13).

export const FUNNEL_EVENTS = [
  "home_view",
  "team_picked",
  "prono_added",
  "save_opened",
  "save_email_submitted",
  "save_google_started",
  "account_created",
  "account_validated",
  "password_created",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export const VISITOR_COOKIE = "pb_vid";
/** Source de la visite (UTM du dernier lien suivi), 30 jours. */
export const UTM_COOKIE = "pb_utm";
/** Posé sur le navigateur d'un admin : ses visites ne sont pas mesurées. */
export const INTERNAL_COOKIE = "pb_internal";
/** Clé de user_metadata qui garde le visiteur jusqu'à la validation du lien (retirée ensuite). */
export const FUNNEL_VID_META = "funnel_vid";

export const UTM_KEYS = ["source", "medium", "campaign", "content"] as const;
export type Utm = Record<(typeof UTM_KEYS)[number], string | null>;

export const NO_UTM: Utm = { source: null, medium: null, campaign: null, content: null };

export type FunnelPayload = {
  visitorId: string;
  event: FunnelEvent;
  matchId: string | null;
  referrer: string | null;
  utm: Utm;
};

// Robots, aperçus de liens et navigateurs sans tête : leurs « visites » ne sont pas des visiteurs.
export const BOT_UA_PATTERNS: readonly RegExp[] = [
  /(^|[^a-z])bot|bot[/;)_-]|bot$/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /scrap/i,
  /HeadlessChrome/i,
  /Lighthouse/i,
  /PageSpeed/i,
  /facebookexternalhit/i,
  /meta-externalagent/i,
  /meta-externalfetcher/i,
  /Bytespider/i,
  /preview/i,
  /curl\//i,
  /wget/i,
  /python-requests/i,
  /node-fetch/i,
  /axios/i,
  /Go-http-client/i,
  /vercel-/i,
];

/** Un User-Agent vide est traité comme un robot. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_UA_PATTERNS.some((re) => re.test(userAgent));
}

const UTM_VALUE = /^[a-z0-9_.-]{1,100}$/;

/** Minuscules puis ^[a-z0-9_.-]{1,100}$ ; null sinon. */
export function cleanUtmValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return UTM_VALUE.test(v) ? v : null;
}

export function cleanUtm(raw: unknown): Utm {
  if (typeof raw !== "object" || raw === null) return { ...NO_UTM };
  const r = raw as Record<string, unknown>;
  return {
    source: cleanUtmValue(r.source),
    medium: cleanUtmValue(r.medium),
    campaign: cleanUtmValue(r.campaign),
    content: cleanUtmValue(r.content),
  };
}

/** Lit les utm_* d'une chaîne de requête (`?utm_source=...`) ; null si aucun n'est présent. */
export function utmFromSearch(search: string): Utm | null {
  const params = new URLSearchParams(search);
  if (!UTM_KEYS.some((k) => params.has(`utm_${k}`))) return null;
  return cleanUtm(Object.fromEntries(UTM_KEYS.map((k) => [k, params.get(`utm_${k}`)])));
}

/** Contenu du cookie pb_utm : une chaîne de requête `source=ig&medium=bio`. */
export function serializeUtm(utm: Utm): string {
  const params = new URLSearchParams();
  for (const k of UTM_KEYS) if (utm[k]) params.set(k, utm[k]);
  return params.toString();
}

export function parseUtmCookie(raw: string | null | undefined): Utm {
  if (!raw) return { ...NO_UTM };
  const params = new URLSearchParams(raw);
  return cleanUtm(Object.fromEntries(UTM_KEYS.map((k) => [k, params.get(k)])));
}

export function isValidVisitorId(value: unknown): value is string {
  return typeof value === "string" && VISITOR.test(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISITOR = /^[A-Za-z0-9-]{8,64}$/;

/** Valide un corps de requête ; null si invalide. Le référent est réduit à son nom d'hôte, les UTM sont nettoyés (jamais de rejet pour un UTM invalide). */
export function parseFunnelPayload(raw: unknown): FunnelPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isValidVisitorId(r.visitorId)) return null;
  if (typeof r.event !== "string" || !(FUNNEL_EVENTS as readonly string[]).includes(r.event)) return null;
  const matchId = typeof r.matchId === "string" && UUID.test(r.matchId) ? r.matchId : null;
  let referrer: string | null = null;
  if (typeof r.referrer === "string" && r.referrer) {
    try {
      referrer = new URL(r.referrer).hostname.slice(0, 200) || null;
    } catch {
      referrer = null;
    }
  }
  return { visitorId: r.visitorId, event: r.event as FunnelEvent, matchId, referrer, utm: cleanUtm(r.utm) };
}
