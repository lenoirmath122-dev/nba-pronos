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
    "mailto:contact@nba-pronos.invalid", // sujet requis par la spec Web Push, jamais utilisé pour un vrai envoi
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

/** Renvoie les ids des abonnements MORTS (410/404) — à supprimer par
 *  l'appelant (`push_subscriptions` n'est pas géré ici, ce module ne fait
 *  qu'envoyer). */
export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload
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
          JSON.stringify(payload)
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // 404/410 = abonnement expiré/révoqué côté navigateur (spec Web Push) —
        // pas une erreur transitoire, à nettoyer. Toute autre erreur est
        // ignorée pour ne pas bloquer l'envoi aux autres abonnés.
        if (statusCode === 404 || statusCode === 410) deadSubscriptionIds.push(sub.id);
      }
    })
  );

  return { deadSubscriptionIds };
}
