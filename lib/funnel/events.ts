// Événements de l'entonnoir de l'accueil (plan d'attractivité, §1.13).

export const FUNNEL_EVENTS = [
  "home_view",
  "team_picked",
  "prono_added",
  "save_opened",
  "save_email_submitted",
  "save_google_started",
  "account_validated",
  "password_created",
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export const VISITOR_COOKIE = "pb_vid";

export type FunnelPayload = { visitorId: string; event: FunnelEvent; matchId: string | null; referrer: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISITOR = /^[A-Za-z0-9-]{8,64}$/;

/** Valide un corps de requête ; null si invalide. Le référent est réduit à son nom d'hôte. */
export function parseFunnelPayload(raw: unknown): FunnelPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.visitorId !== "string" || !VISITOR.test(r.visitorId)) return null;
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
  return { visitorId: r.visitorId, event: r.event as FunnelEvent, matchId, referrer };
}
