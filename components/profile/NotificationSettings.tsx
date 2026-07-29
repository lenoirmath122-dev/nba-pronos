"use client";

import { useEffect, useState } from "react";
import {
  updateNotificationPreference,
  savePushSubscription,
  deletePushSubscription,
} from "@/lib/actions/notifications";
import styles from "./NotificationSettings.module.css";

// Réglage "Rappels" (Profil, backlog "Rappels ciblés") — SEUL composant
// client de l'écran Profil : la permission navigateur + l'abonnement Push
// (Notification.requestPermission, ServiceWorker, PushManager) ne sont
// atteignables qu'en JS client, contrairement au reste de l'écran (formulaires
// natifs). Canal EMAIL sélectionnable mais désactivé (bloqué sur un SMTP
// personnalisé — GAPS_OUVERTS.md "Confirm email") — choisi AVEC l'utilisateur,
// 29/07/2026 : Push d'abord, Email plus tard.

type Preference = "NONE" | "PUSH" | "EMAIL";

type NotificationSettingsProps = {
  initialPreference: Preference;
};

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

function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
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

export function NotificationSettings({ initialPreference }: NotificationSettingsProps) {
  const [preference, setPreference] = useState<Preference>(initialPreference);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La préférence est liée au COMPTE, pas à l'appareil : un joueur connecté
  // sur 2 appareils (ex. PC + téléphone) peut avoir `preference === "PUSH"`
  // sans que CET appareil précis ait un abonnement local — dans ce cas, le
  // radio "Push" s'affiche déjà coché et un clic dessus ne déclenche RIEN
  // (un <input type="radio"> déjà sélectionné ne déclenche pas onChange),
  // donc impossible d'activer le 2e appareil sans ce statut séparé. Trouvé
  // en testant en conditions réelles (compte partagé PC/iPhone, 29/07/2026).
  const [deviceSubscribed, setDeviceSubscribed] = useState<boolean | null>(() => (pushSupported() ? null : false));

  useEffect(() => {
    if (!pushSupported()) return; // déjà réglé à `false` par l'état initial ci-dessus
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription() ?? null)
      .then((subscription) => {
        if (!cancelled) setDeviceSubscribed(subscription !== null);
      })
      .catch(() => {
        if (!cancelled) setDeviceSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePush() {
    setPending(true);
    setError(null);
    try {
      if (!pushSupported()) {
        setError("Les notifications push ne sont pas prises en charge par ce navigateur.");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("Configuration push manquante.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permission refusée par le navigateur.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await subscribeWithRetry(registration, urlBase64ToUint8Array(publicKey));
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("Abonnement incomplet, réessaie.");
        return;
      }

      const saveResult = await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (!saveResult.success) {
        setError(saveResult.error);
        return;
      }

      const prefResult = await updateNotificationPreference("PUSH");
      if (!prefResult.success) {
        setError(prefResult.error);
        return;
      }
      setPreference("PUSH");
      setDeviceSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  async function disableNotifications() {
    setPending(true);
    setError(null);
    try {
      if (pushSupported()) {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await deletePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
      }

      const prefResult = await updateNotificationPreference("NONE");
      if (!prefResult.success) {
        setError(prefResult.error);
        return;
      }
      setPreference("NONE");
      setDeviceSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  function handleChange(next: Preference) {
    if (pending || next === preference) return;
    if (next === "PUSH") void enablePush();
    if (next === "NONE") void disableNotifications();
    // "EMAIL" : option désactivée, aucun handler.
  }

  return (
    <div className={styles.group}>
      <label className={styles.option}>
        <input
          type="radio"
          name="notificationPreference"
          checked={preference === "NONE"}
          disabled={pending}
          onChange={() => handleChange("NONE")}
        />
        Aucun
      </label>
      <label className={styles.option}>
        <input
          type="radio"
          name="notificationPreference"
          checked={preference === "PUSH"}
          disabled={pending}
          onChange={() => handleChange("PUSH")}
        />
        Notifications push
      </label>
      <label className={`${styles.option} ${styles.optionDisabled}`}>
        <input type="radio" name="notificationPreference" checked={preference === "EMAIL"} disabled />
        Email <span className={styles.soon}>(bientôt disponible)</span>
      </label>

      {/* Compte déjà en Push (ex. activé depuis un autre appareil) mais CET
          appareil n'a pas encore son propre abonnement local — le radio
          "Push" ci-dessus est déjà coché, cliquer dessus ne fait donc rien
          (comportement natif d'un <input type="radio">). */}
      {preference === "PUSH" && deviceSubscribed === false && (
        <div className={styles.deviceNotice}>
          <p className={styles.deviceNoticeText}>
            Push activé sur ton compte, mais pas encore sur cet appareil.
          </p>
          <button type="button" className={styles.deviceButton} disabled={pending} onClick={() => void enablePush()}>
            Activer sur cet appareil
          </button>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
