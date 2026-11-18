"use client";

import { useSyncExternalStore } from "react";
import { androidChromeIntentUrl, isAndroid, isInAppBrowser } from "@/lib/auth/inAppBrowser";
import styles from "@/components/auth/AuthScreen.module.css";

// Remplace le bouton Google dans un navigateur intégré (Instagram, Facebook,
// TikTok...) : Google y refuse la connexion. Le lien magique par e-mail
// fonctionne partout ; on invite en plus à ouvrir la page dans le vrai navigateur.

function subscribeToNothing() {
  return () => {};
}
const getInApp = () => isInAppBrowser(navigator.userAgent);
const getAndroid = () => isAndroid(navigator.userAgent);
const getServer = () => false; // rendu serveur : rien, jamais de flash.

export function OpenInBrowserNotice() {
  const inApp = useSyncExternalStore(subscribeToNothing, getInApp, getServer);
  const android = useSyncExternalStore(subscribeToNothing, getAndroid, getServer);
  if (!inApp) return null;

  const intent = android ? androidChromeIntentUrl(window.location.href) : null;
  return (
    <div role="note" className={styles.hint}>
      <p>Google ne marche pas dans ce navigateur. Utilise ton e-mail, ou ouvre la page dans ton navigateur habituel.</p>
      {intent ? (
        <a href={intent} className={styles.link}>
          Ouvrir dans Chrome
        </a>
      ) : (
        <p>Sur iPhone : menu ··· puis « Ouvrir dans Safari ».</p>
      )}
    </div>
  );
}
