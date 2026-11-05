import "server-only";
import { cookies, headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { detectInAppBrowser } from "@/lib/auth/inAppBrowser";
import {
  INTERNAL_COOKIE,
  UTM_COOKIE,
  VISITOR_COOKIE,
  isValidVisitorId,
  parseUtmCookie,
  type FunnelEvent,
  type Utm,
} from "./events";

// Écriture d'un événement d'entonnoir côté serveur. Aucun identifiant de compte :
// seulement le visiteur (cookie), la source (UTM) et la famille de navigateur.

export type FunnelRow = {
  visitorId: string;
  event: FunnelEvent;
  matchId?: string | null;
  referrer?: string | null;
  utm: Utm;
  inAppBrowser: string | null;
};

/** Seule la production alimente la table : le développement local et les aperçus n'écrivent rien. */
export function funnelWritesEnabled(): boolean {
  return process.env.VERCEL_ENV === "production";
}

// Colonne absente (code pas encore suivi de la migration) : PostgREST répond PGRST204, Postgres 42703.
function isMissingColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST204" || error.code === "42703" || /could not find the .* column/i.test(error.message ?? "");
}

export async function insertFunnelEvent(row: FunnelRow): Promise<void> {
  if (!funnelWritesEnabled()) return;
  const service = getServiceClient();
  const base = {
    visitor_id: row.visitorId,
    event: row.event,
    match_id: row.matchId ?? null,
    referrer: row.referrer ?? null,
  };
  const { error } = await service.from("funnel_events").insert({
    ...base,
    utm_source: row.utm.source,
    utm_medium: row.utm.medium,
    utm_campaign: row.utm.campaign,
    utm_content: row.utm.content,
    in_app_browser: row.inAppBrowser,
  });
  if (!error) return;
  if (isMissingColumn(error)) {
    // Ordre de mise en production : le code peut partir avant la migration, sans perdre l'événement.
    const retry = await service.from("funnel_events").insert(base);
    if (!retry.error) return;
    console.error(`funnel_events : insertion en échec — ${retry.error.message}`);
    return;
  }
  console.error(`funnel_events : insertion en échec — ${error.message}`);
}

/**
 * Fin d'entonnoir : `account_created`, avec le visiteur et les UTM lus dans les cookies de la requête.
 * Ne lève jamais : la mesure ne doit pas bloquer une inscription.
 */
export async function trackAccountCreated(): Promise<void> {
  try {
    const store = await cookies();
    const visitor = store.get(VISITOR_COOKIE)?.value;
    if (!isValidVisitorId(visitor) || store.get(INTERNAL_COOKIE)) return;
    const userAgent = (await headers()).get("user-agent");
    await insertFunnelEvent({
      visitorId: visitor,
      event: "account_created",
      utm: parseUtmCookie(store.get(UTM_COOKIE)?.value),
      inAppBrowser: detectInAppBrowser(userAgent),
    });
  } catch (e) {
    console.error("funnel : account_created en échec —", e instanceof Error ? e.message : e);
  }
}

/** Visiteur du cookie de la requête (pour le garder dans user_metadata), ou null. */
export async function currentVisitorId(): Promise<string | null> {
  try {
    const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
    return isValidVisitorId(visitor) ? visitor : null;
  } catch {
    return null;
  }
}
