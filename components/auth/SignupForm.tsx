"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signup } from "@/lib/auth/actions";
import styles from "./AuthScreen.module.css";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  // Vérification PUREMENT client (28/08/2026, demandé par l'utilisateur) :
  // le 2e champ n'est jamais lu côté serveur (pas de name= voulu pour ça),
  // juste un garde-fou avant soumission — aucun changement de
  // lib/auth/actions.ts nécessaire.
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;
    if (password !== confirmPassword) {
      event.preventDefault();
      setMismatchError("Les mots de passe ne correspondent pas.");
      return;
    }
    setMismatchError(null);
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Inscription</h1>
      <form action={formAction} onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="pseudo" className={styles.fieldLabel}>
            Pseudo
          </label>
          <input
            id="pseudo"
            name="pseudo"
            type="text"
            required
            autoComplete="username"
            className={styles.input}
          />
        </div>
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
            minLength={8}
            autoComplete="new-password"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="confirmPassword" className={styles.fieldLabel}>
            Confirme le mot de passe
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="code" className={styles.fieldLabel}>
            Code compétition
          </label>
          <input id="code" name="code" type="text" required className={styles.input} />
        </div>
        {(mismatchError || state?.error) && (
          <p role="alert" className={styles.error}>
            {mismatchError ?? state?.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Création…" : "Créer mon compte"}
        </button>
      </form>
      <div className={styles.links}>
        <p className={styles.linkLine}>
          Déjà un compte ?{" "}
          <Link href="/login" className={styles.link}>
            Connecte-toi
          </Link>
        </p>
      </div>
    </div>
  );
}
