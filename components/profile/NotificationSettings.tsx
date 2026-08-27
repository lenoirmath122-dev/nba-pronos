"use client";

import { useEffect, useState } from "react";
import { updateNotificationPreference, deletePushSubscription } from "@/lib/actions/notifications";
import { ensurePushSubscribed, pushSupported } from "@/lib/push/client";
import styles from "./NotificationSettings.module.css";

// Réglage "Rappels" (Profil, backlog "Rappels ciblés") — SEUL composant
// client de l'écran Profil : la permission navigateur + l'abonnement Push
// (Notification.requestPermission, ServiceWorker, PushManager) ne sont
// atteignables qu'en JS client, contrairement au reste de l'écran (formulaires
// natifs). Canal EMAIL sélectionnable mais désactivé (bloqué sur un SMTP
// personnalisé — GAPS_OUVERTS.md "Confirm email") — choisi AVEC l'utilisateur,
// 29/07/2026 : Push d'abord, Email plus tard.
//
// Permission + abonnement + préférence compte : lib/push/client.ts
// (ensurePushSubscribed), extrait le 27/08/2026 pour être réutilisé par
// ChatNotificationToggle.tsx (addendum SPEC_CHAT_V0_1.md) sans dupliquer
// cette logique déjà débogée (retry AbortError, conversion VAPID).

type Preference = "NONE" | "PUSH" | "EMAIL";

type NotificationSettingsProps = {
  initialPreference: Preference;
};

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
  // `null` sur les 2 rendus (serveur ET client, avant hydratation) — jamais
  // `pushSupported()` dans l'état initial : cette fonction lit `navigator`/
  // `window`, absents côté serveur, donc `false` en SSR mais potentiellement
  // `true` au tout premier rendu client. Ça produisait une erreur
  // d'hydratation React (le HTML serveur et client divergeaient sur
  // `.deviceNotice`, trouvé en audit le 16/08/2026) : React exige que le 1er
  // rendu client soit identique au HTML serveur, avant que les effets ne
  // s'exécutent. La vraie valeur n'est déterminée qu'après montage, dans
  // l'effet ci-dessous (client uniquement, donc sûr).
  const [deviceSubscribed, setDeviceSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    // `setState` déclenché uniquement dans les callbacks .then()/.catch()
    // ci-dessous, jamais de façon synchrone dans le corps de l'effet (règle
    // react-hooks/set-state-in-effect) — la branche "non supporté" passe
    // donc aussi par une promesse résolue immédiatement plutôt qu'un retour
    // anticipé avec un setState direct.
    let cancelled = false;
    const supported = pushSupported();
    const subscriptionPromise = supported
      ? navigator.serviceWorker
          .getRegistration("/sw.js")
          .then((registration) => registration?.pushManager.getSubscription() ?? null)
      : Promise.resolve(null);
    subscriptionPromise
      .then((subscription) => {
        if (!cancelled) setDeviceSubscribed(supported && subscription !== null);
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
      const result = await ensurePushSubscribed();
      if (!result.ok) {
        setError(result.error);
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
