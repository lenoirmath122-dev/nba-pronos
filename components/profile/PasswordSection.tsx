"use client";

import { trackFunnel } from "@/lib/funnel/track";
import { useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from "@/lib/auth/passwordPolicy";
import styles from "./PasswordSection.module.css";

// Mot de passe facultatif (plan d'attractivité, §1.6 e) : le joueur se connecte
// par lien ou Google ; il peut en plus créer (ou changer) un mot de passe.
export function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDone(false);
    const policy = passwordPolicyError(password);
    if (policy) return setError(policy);
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas.");
    setPending(true);
    const { error: updateError } = await getBrowserClient().auth.updateUser({ password });
    setPending(false);
    if (updateError) return setError("Impossible d'enregistrer le mot de passe. Reconnecte-toi puis réessaie.");
    setPassword("");
    setConfirm("");
    trackFunnel("password_created");
    setDone(true);
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <p className={styles.hint}>Facultatif : tu peux toujours te connecter avec un lien reçu par email.</p>
      <label className={styles.label}>
        Nouveau mot de passe
        <input
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
        />
      </label>
      <label className={styles.label}>
        Confirme le mot de passe
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={styles.input}
        />
      </label>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {done ? <p className={styles.success}>Mot de passe enregistré.</p> : null}
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
