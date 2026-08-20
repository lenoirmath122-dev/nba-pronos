"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/lib/auth/actions";
import styles from "./AuthScreen.module.css";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Inscription</h1>
      <form action={formAction} className={styles.form}>
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
          <label htmlFor="code" className={styles.fieldLabel}>
            Code compétition
          </label>
          <input id="code" name="code" type="text" required className={styles.input} />
        </div>
        {state?.error && (
          <p role="alert" className={styles.error}>
            {state.error}
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
