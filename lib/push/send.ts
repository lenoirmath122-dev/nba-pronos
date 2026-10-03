import "server-only";
import webpush from "web-push";

// Envoi Web Push (rappels ciblés, backlog) — réservé aux routes /api/reminders/*
// (service_role). L'import "server-only" fait échouer la compilation si ce
// module est importé depuis un composant "use client" — VAPID_PRIVATE_KEY ne
// doit jamais atteindre le navigateur (même garde que getServiceClient()).

let configured = false;

function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    // Sujet requis par la spec Web Push (RFC 8292) — DOIT être une URL/mailto:
    // RÉSOLVABLE : Apple (web.push.apple.com) rejette les domaines factices
    // (`BadJwtToken`) comme `.invalid` (constaté en test réel, même famille
    // que `.test` déjà rejeté ailleurs par Supabase Auth) ; Google/FCM, lui,
    // ne validait pas ce point, d'où l'écart passé inaperçu au premier test.
    // L'URL réelle du site est toujours valide, aucune config supplémentaire.
    "https://nba-pronos.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// Durée de vie par défaut d'un push non délivré (téléphone éteint/hors
// réseau). Le défaut de web-push (4 semaines) n'a aucun sens pour des rappels
// datés : un "match ce soir" reçu 3 jours plus tard est pire que rien.
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

/** TTL = secondes restantes jusqu'à `deadline` (le rappel devient inutile
 *  après), avec un plancher pour laisser le temps de livrer. */
export function ttlUntil(deadline: string | Date): number {
  const seconds = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000);
  return Math.max(seconds, 60);
}

/** Renvoie les ids des abonnements MORTS (410/404) — à supprimer par
 *  l'appelant (`push_subscriptions` n'est pas géré ici, ce module ne fait
 *  qu'envoyer). */
export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload,
  options: { ttlSeconds?: number } = {}
): Promise<{ deadSubscriptionIds: string[] }> {
  ensureConfigured();

  const deadSubscriptionIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          JSON.stringify(payload),
          {
            // Retour de l'alpha (03/10/2026) : push reçus seulement si l'app
            // avait été ouverte récemment. Sans option, web-push envoie en
            // urgence "normal" : FCM/APNs la traitent en basse priorité et
            // la retiennent tant que le téléphone est en veille (Doze
            // Android, économie d'énergie iOS). Toutes nos notifications
            // sont visibles et datées → "high" (priorité haute FCM,
            // apns-priority 10).
            urgency: "high",
            TTL: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
          }
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404/410 = abonnement expiré/révoqué côté navigateur (spec Web Push) —
        // pas une erreur transitoire, à nettoyer. Toute autre erreur ne
        // bloque pas l'envoi aux autres abonnés, mais est journalisée : elle
        // était avalée en silence jusqu'ici, impossible de diagnostiquer un
        // push perdu.
        if (statusCode === 404 || statusCode === 410) {
          deadSubscriptionIds.push(sub.id);
        } else {
          const service = new URL(sub.endpoint).host;
          const body = (error as { body?: string }).body;
          console.error(`sendPushToSubscriptions: échec ${statusCode ?? "?"} vers ${service}`, body ?? error);
        }
      }
    })
  );

  return { deadSubscriptionIds };
}
