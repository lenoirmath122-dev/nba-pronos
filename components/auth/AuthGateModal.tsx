"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { registerPronos, requestLoginLink } from "@/lib/auth/guest";
import { BASKET_KEY, parseBasket, type BasketItem } from "@/lib/publicHome/basket";
import { PSEUDO_MAX_LENGTH } from "@/lib/pseudo/rules";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { OpenInBrowserNotice } from "@/components/auth/OpenInBrowserNotice";
import styles from "@/components/auth/AuthScreen.module.css";
import gate from "./AuthGateModal.module.css";

// Modale « Crée ton compte » du mode invité. Réutilise le chemin unique
// d'inscription (registerPronos : compte PENDING + lien magique) ; l'e-mail déjà
// connu reçoit un lien de connexion, sans fuite sur qui est inscrit.

function readBasket(): BasketItem[] {
  try {
    return parseBasket(window.localStorage.getItem(BASKET_KEY));
  } catch {
    return [];
  }
}

export function AuthGateModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [pseudo, setPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        mode === "signup"
          ? await registerPronos({ pseudo, email, ageConfirmed: age, items: readBasket() })
          : await requestLoginLink(email);
      if (result.ok) setSentTo(email.trim());
      else setError(result.error);
    });
  }

  return (
    <dialog ref={dialogRef} className={gate.dialog} onClose={onClose} aria-labelledby="gate-title">
      <div className={gate.content}>
        <button type="button" onClick={() => dialogRef.current?.close()} className={gate.close} aria-label="Fermer">
          ×
        </button>
        {sentTo ? (
          <>
            <h2 id="gate-title" className={styles.cardTitle}>
              Vérifie ta boîte mail
            </h2>
            <p className={styles.hint}>
              On t&apos;a envoyé un lien : un clic et tu reprends là où tu en étais. Rien reçu ? Regarde les spams.
            </p>
          </>
        ) : (
          <>
            <h2 id="gate-title" className={styles.cardTitle}>
              {mode === "signup" ? "Crée ton compte pour continuer" : "Reçois un lien de connexion"}
            </h2>
            <form onSubmit={submit} className={styles.form}>
              {mode === "signup" ? (
                <div className={styles.field}>
                  <label htmlFor="gate-pseudo" className={styles.fieldLabel}>
                    Pseudo
                  </label>
                  <input
                    id="gate-pseudo"
                    type="text"
                    required
                    maxLength={PSEUDO_MAX_LENGTH}
                    autoComplete="nickname"
                    value={pseudo}
                    onChange={(e) => setPseudo(e.target.value)}
                    className={styles.input}
                  />
                </div>
              ) : null}
              <div className={styles.field}>
                <label htmlFor="gate-email" className={styles.fieldLabel}>
                  Email
                </label>
                <input
                  id="gate-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                />
              </div>
              {mode === "signup" ? (
                <div className={styles.checkboxField}>
                  <input
                    id="gate-age"
                    type="checkbox"
                    checked={age}
                    onChange={(e) => setAge(e.target.checked)}
                    className={styles.checkbox}
                  />
                  <label htmlFor="gate-age" className={styles.checkboxLabel}>
                    J&apos;ai 15 ans ou plus
                  </label>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              ) : null}
              <button type="submit" disabled={pending} className={styles.submit}>
                {pending ? "Envoi…" : mode === "signup" ? "Créer mon compte" : "Recevoir le lien"}
              </button>
            </form>
            {mode === "signup" ? (
              <>
                <p className={styles.separator}>ou</p>
                <GoogleButton />
                <OpenInBrowserNotice />
              </>
            ) : null}
            <p className={styles.linkLine}>
              <button
                type="button"
                className={gate.switch}
                onClick={() => {
                  setError(null);
                  setMode(mode === "signup" ? "login" : "signup");
                }}
              >
                {mode === "signup" ? "Déjà un compte ? Recevoir un lien" : "Pas de compte ? Créer le mien"}
              </button>
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
