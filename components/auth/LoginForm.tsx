"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { login } from "@/lib/auth/actions";
import styles from "./AuthScreen.module.css";

// Pas de souscription réelle : l'URL ne change pas après le montage sur cet
// écran (pas de navigation interne qui la modifierait) — no-op suffisant.
function subscribeToNothing() {
  return () => {};
}
function getResetSuccessFromUrl() {
  return new URLSearchParams(window.location.search).get("resetSuccess") === "1";
}
function getResetSuccessServerSnapshot() {
  return false; // rendu serveur : pas de window, jamais le message au 1er rendu.
}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  // Lu côté client (pas useSearchParams, pour rester hors de toute contrainte
  // Suspense) — juste un message de courtoisie après un reset réussi
  // (ResetPasswordForm.tsx). useSyncExternalStore plutôt qu'un effet +
  // setState : lit une donnée EXTERNE (l'URL) sans le rendu intermédiaire ni
  // le risque de désynchro hydratation d'un `useEffect` classique.
  const resetSuccess = useSyncExternalStore(
    subscribeToNothing,
    getResetSuccessFromUrl,
    getResetSuccessServerSnapshot
  );

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Connexion</h1>
      <form action={formAction} className={styles.form}>
        {resetSuccess && (
          <p className={styles.success}>
            Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe.
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="email" className={styles.fieldLabel}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.fieldLabel}>
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={styles.input}
          />
        </div>
        {state?.error && (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <div className={styles.links}>
        <p className={styles.linkLine}>
          <Link href="/reset-password" className={styles.link}>
            Mot de passe oublié ?
          </Link>
        </p>
        <p className={styles.linkLine}>
          Pas encore de compte ?{" "}
          <Link href="/signup" className={styles.link}>
            Inscris-toi
          </Link>
        </p>
      </div>
    </div>
  );
}
