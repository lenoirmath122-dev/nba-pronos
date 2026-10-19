"use client";

import { useEffect, useState } from "react";
import {
  updateNotificationPreference,
  updateEmailPreference,
  updatePopupMentionsOptOut,
  updateRecapPreference,
  deletePushSubscription,
} from "@/lib/actions/notifications";
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
  initialRecapEnabled: boolean;
  initialPopupMentionsOptOut: boolean;
  initialEmailResults: boolean;
  initialEmailReminders: boolean;
};

export function NotificationSettings({
  initialPreference,
  initialRecapEnabled,
  initialPopupMentionsOptOut,
  initialEmailResults,
  initialEmailReminders,
}: NotificationSettingsProps) {
  const [preference, setPreference] = useState<Preference>(initialPreference);
  const [recapEnabled, setRecapEnabled] = useState(initialRecapEnabled);
  const [popupOptOut, setPopupOptOut] = useState(initialPopupMentionsOptOut);
  const [emailResults, setEmailResults] = useState(initialEmailResults);
  const [emailReminders, setEmailReminders] = useState(initialEmailReminders);
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

  async function toggleRecaps(next: boolean) {
    setPending(true);
    setError(null);
    setRecapEnabled(next);
    try {
      const result = await updateRecapPreference(next);
      if (!result.success) {
        setRecapEnabled(!next);
        setError(result.error);
      }
    } catch (err) {
      setRecapEnabled(!next);
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  async function toggleEmail(kind: "results" | "reminders", next: boolean) {
    const setValue = kind === "results" ? setEmailResults : setEmailReminders;
    setPending(true);
    setError(null);
    setValue(next);
    try {
      const result = await updateEmailPreference(kind, next);
      if (!result.success) {
        setValue(!next);
        setError(result.error);
      }
    } catch (err) {
      setValue(!next);
      setError(err instanceof Error ? err.message : "Erreur inattendue, réessaie.");
    } finally {
      setPending(false);
    }
  }

  async function togglePopupOptOut(next: boolean) {
    setPending(true);
    setError(null);
    setPopupOptOut(next);
    try {
      const result = await updatePopupMentionsOptOut(next);
      if (!result.success) {
        setPopupOptOut(!next);
        setError(result.error);
      }
    } catch (err) {
      setPopupOptOut(!next);
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

      {/* Récaps du matin (p3-10) : n'ont de sens qu'avec le push actif. */}
      {preference === "PUSH" && (
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={recapEnabled}
            disabled={pending}
            onChange={(event) => void toggleRecaps(event.target.checked)}
          />
          <span>
            Récap du matin <span className={styles.soon}>(10h, ta semaine le lundi)</span>
          </span>
        </label>
      )}

      {/* E-mails (1B) : indépendants du canal push ci-dessus. */}
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={emailResults}
          disabled={pending}
          onChange={(event) => void toggleEmail("results", event.target.checked)}
        />
        <span>
          Résultats du matin par e-mail <span className={styles.soon}>(quand tes pronos ont été jugés)</span>
        </span>
      </label>
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={emailReminders}
          disabled={pending}
          onChange={(event) => void toggleEmail("reminders", event.target.checked)}
        />
        <span>
          Rappel du soir par e-mail <span className={styles.soon}>(si un match arrive et que tu n&apos;as pas pronostiqué)</span>
        </span>
      </label>

      {/* Popup hebdo (lot 5) : indépendante du canal push, c'est une popup à
          l'ouverture de l'appli. Rétroactif, y compris pour les textes déjà
          publiés. */}
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={popupOptOut}
          disabled={pending}
          onChange={(event) => void togglePopupOptOut(event.target.checked)}
        />
        <span>
          Ne pas me citer dans la popup du lundi{" "}
          <span className={styles.soon}>(effet rétroactif : un texte déjà publié dira « un joueur discret »)</span>
        </span>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
