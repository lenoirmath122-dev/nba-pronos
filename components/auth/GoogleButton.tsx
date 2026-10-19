"use client";

import { useState, useSyncExternalStore } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { isInAppBrowser } from "@/lib/auth/inAppBrowser";
import styles from "./AuthScreen.module.css";

// « Continuer avec Google » (plan d'attractivité, §1.6 d). Le retour passe par
// /auth/callback (échange du code), qui renvoie vers le choix du pseudo pour un
// premier passage. Masqué dans les navigateurs intégrés (Instagram, Facebook) :
// Google y refuse la connexion.

function subscribeToNothing() {
  return () => {};
}
const getInApp = () => isInAppBrowser(navigator.userAgent);
const getInAppServer = () => true; // rendu serveur : masqué, jamais de flash du bouton.

export function GoogleButton({ label = "Continuer avec Google" }: { label?: string }) {
  const hidden = useSyncExternalStore(subscribeToNothing, getInApp, getInAppServer);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  async function start() {
    setError(null);
    const { error: oauthError } = await getBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) setError("Connexion Google indisponible pour le moment.");
  }

  return (
    <>
      <button type="button" onClick={start} className={styles.secondary}>
        {label}
      </button>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </>
  );
}
