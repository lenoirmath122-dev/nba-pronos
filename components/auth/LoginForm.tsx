"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { login } from "@/lib/auth/actions";
import { requestLoginLink } from "@/lib/auth/guest";
import { GoogleButton } from "./GoogleButton";
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

// Même patron que resetSuccess ci-dessus, pour confirmer une suppression de
// compte en self-service (lib/actions/account.ts, redirect vers
// /login?accountDeleted=1).
function getAccountDeletedFromUrl() {
  return new URLSearchParams(window.location.search).get("accountDeleted") === "1";
}
function getAccountDeletedServerSnapshot() {
  return false;
}

function PasswordLogin({ onBack }: { onBack: () => void }) {
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
  const accountDeleted = useSyncExternalStore(
    subscribeToNothing,
    getAccountDeletedFromUrl,
    getAccountDeletedServerSnapshot
  );

  return (
    <>
      <form action={formAction} className={styles.form}>
        {resetSuccess && (
          <p className={styles.success}>
            Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe.
          </p>
        )}
        {accountDeleted && (
          <p className={styles.success}>Ton compte a bien été supprimé.</p>
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
          <button type="button" onClick={onBack} className={styles.linkButton}>
            Mot de passe oublié ? Recevoir un lien de connexion
          </button>
        </p>
      </div>
    </>
  );
}

function LinkLogin({ onPassword }: { onPassword: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const linkInvalid = useSyncExternalStore(
    subscribeToNothing,
    () => new URLSearchParams(window.location.search).get("lien") === "invalide",
    () => false
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestLoginLink(email);
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  if (sent) {
    return (
      <>
        <p className={styles.hint}>Si cette adresse a un compte, un lien de connexion vient de t&apos;être envoyé. Ouvre le mail.</p>
        <p className={styles.hint}>Je n&apos;ai rien reçu ? Vérifie tes spams.</p>
      </>
    );
  }

  return (
    <>
      <form onSubmit={submit} className={styles.form}>
        {linkInvalid && (
          <p role="alert" className={styles.error}>
            Ce lien n&apos;est plus valable. Demande-en un nouveau.
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="email" className={styles.fieldLabel}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Envoi…" : "Recevoir un lien de connexion"}
        </button>
      </form>
      <p className={styles.separator}>ou</p>
      <GoogleButton />
      <button type="button" onClick={onPassword} className={styles.secondary}>
        Email + mot de passe
      </button>
    </>
  );
}

// Trois options (plan d'attractivité, §1.6 e) : lien de connexion par défaut,
// e-mail + mot de passe, Google. Le mot de passe reste facultatif.
export function LoginForm() {
  const [mode, setMode] = useState<"link" | "password">("link");

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Connexion</h1>
      {mode === "link" ? <LinkLogin onPassword={() => setMode("password")} /> : <PasswordLogin onBack={() => setMode("link")} />}
      <div className={styles.links}>
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
