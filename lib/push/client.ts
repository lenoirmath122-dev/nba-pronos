import { savePushSubscription, updateNotificationPreference } from "@/lib/actions/notifications";

// Logique CLIENT du Push (permission navigateur + ServiceWorker + PushManager),
// extraite de components/profile/NotificationSettings.tsx le 27/08/2026 pour
// être réutilisée par ChatNotificationToggle.tsx (addendum SPEC_CHAT_V0_1.md)
// sans dupliquer une logique déjà débogée en conditions réelles (retry
// AbortError, conversion VAPID) -- module PUR (pas de hooks, pas de JSX),
// importable depuis n'importe quel composant "use client".

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** iPhone/iPad ouvert dans le navigateur plutôt que depuis l'app installée
 *  à l'écran d'accueil (p3-13) : Apple n'expose le Push web QU'aux apps
 *  installées (cf. app/manifest.ts) — dans un onglet Safari, PushManager
 *  est simplement absent et aucun bouton "Activer" ne peut marcher ; il
 *  faut d'abord proposer l'installation. iPadOS se présente comme un Mac
 *  ("MacIntel") mais avec un écran tactile, d'où le 2e test. */
export function iosNeedsInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

// PushManager.subscribe() exige un Uint8Array adossé à un vrai ArrayBuffer
// (BufferSource), la clé VAPID publique est distribuée en base64 URL-safe —
// conversion standard, aucune lib dédiée.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

// Constaté en test (juste après un premier enregistrement de service
// worker) : le service push peut mettre un instant à être prêt et
// `subscribe()` échoue une première fois (AbortError). Un seul nouvel essai
// après une courte pause suffit — pas la peine d'une file de retry plus
// élaborée pour un cas aussi ponctuel.
async function subscribeWithRetry(
  registration: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array<ArrayBuffer>
): Promise<PushSubscription> {
  try {
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  }
}

export type EnsurePushResult = { ok: true } | { ok: false; error: string };

/** Permission + abonnement Push + préférence compte "PUSH" en une fois --
 *  idempotent (réutilise un abonnement déjà présent sur cet appareil). Ne
 *  gère PAS l'état "abonné sur un autre appareil, pas celui-ci" (spécifique
 *  à l'écran Profil, cf. NotificationSettings.tsx) -- l'appelant sait déjà
 *  s'il doit proposer ce flux. */
export async function ensurePushSubscribed(): Promise<EnsurePushResult> {
  if (!pushSupported()) {
    return { ok: false, error: "Les notifications push ne sont pas prises en charge par ce navigateur." };
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return { ok: false, error: "Configuration push manquante." };
  }

  const permission = await Notification.requestPermission();
  // "denied" est définitif côté navigateur : requestPermission() ne
  // réaffichera plus jamais la demande, seul un réglage manuel du
  // téléphone/navigateur la débloque (p3-13) — à dire explicitement au
  // joueur plutôt qu'un simple "refusé" qui laisse croire qu'il suffit de
  // recliquer. "default" = demande fermée sans choix, elle reviendra.
  if (permission === "denied") {
    return {
      ok: false,
      error:
        "Notifications bloquées pour Panier Ballon. Réactive-les dans les réglages de ton téléphone (ou de ton navigateur), puis réessaie.",
    };
  }
  if (permission !== "granted") {
    return { ok: false, error: "Autorisation non accordée, réessaie." };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await subscribeWithRetry(registration, urlBase64ToUint8Array(publicKey));
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Abonnement incomplet, réessaie." };
  }

  const saveResult = await savePushSubscription({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  if (!saveResult.success) return { ok: false, error: saveResult.error };

  const prefResult = await updateNotificationPreference("PUSH");
  if (!prefResult.success) return { ok: false, error: prefResult.error };

  return { ok: true };
}
