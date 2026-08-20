"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";
import { MailIcon } from "@/components/icons/auth-icons";
import styles from "./AuthScreen.module.css";

// Flux Supabase STANDARD (T2 §8, T6a arbre app/ — UNE seule route pour les 2
// étapes) : ni server action, ni logique métier à nous — la demande ET la
// confirmation passent directement par le SDK client (contrairement à
// login/signup/logout, server actions, car il n'y a ici aucune donnée
// applicative à nous à valider avant Supabase). Le lien reçu par email dépose
// un jeton dans l'URL (fragment `#access_token=...&type=recovery`) que le
// client navigateur (session en cookie, lib/supabase/browser.ts) détecte
// automatiquement au chargement — c'est CE signal (`onAuthStateChange`,
// événement `PASSWORD_RECOVERY`) qui bascule cette page de "demander un
// email" à "choisir un nouveau mot de passe", jamais un paramètre d'URL lu
// nous-mêmes.
export function ResetPasswordForm() {
  const [mode, setMode] = useState<"checking" | "request" | "confirm">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();

    // Si le lien reçu par email vient d'être traité, une session de
    // récupération existe déjà au tout premier rendu.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMode(session ? "confirm" : "request");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("confirm");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = getBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (resetError) {
      setError("Impossible d'envoyer l'email pour le moment. Réessaie plus tard.");
      return;
    }
    // Message générique QUE l'email existe ou non en base (D5 : l'email
    // reste un identifiant privé, cet écran ne doit jamais confirmer/infirmer
    // l'existence d'un compte).
    setRequestSent(true);
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPending(true);
    const supabase = getBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError("Impossible de mettre à jour le mot de passe. Réessaie.");
      return;
    }
    // Reconnexion propre demandée plutôt que garder la session de
    // récupération (portée volontairement restreinte côté Supabase) —
    // cohérent avec logout() (lib/auth/actions.ts), même destination /login.
    await supabase.auth.signOut();
    window.location.href = "/login?resetSuccess=1";
  }

  if (mode === "checking") {
    return <p className={styles.loading}>Chargement…</p>;
  }

  if (mode === "request") {
    if (requestSent) {
      // EXCEPTION actée (AJUSTEMENTS_VISUELS_20_08_2026 §1) : seul état de ce
      // formulaire volontairement SANS carte — pure information (rien à
      // faire, juste attendre), pas une action comme les 3 autres états.
      return (
        <div className={styles.infoState}>
          <MailIcon />
          <p className={styles.infoStateText}>
            Si un compte existe avec cet email, un lien de réinitialisation vient
            d&apos;être envoyé. Vérifie ta boîte de réception.
          </p>
        </div>
      );
    }
    return (
      <div className={`${styles.card} glass-card`}>
        <h1 className={styles.cardTitle}>Réinitialiser le mot de passe</h1>
        <form onSubmit={handleRequest} className={styles.form}>
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
            {pending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
          </button>
        </form>
        <div className={styles.links}>
          <p className={styles.linkLine}>
            <Link href="/login" className={styles.link}>
              Retour à la connexion
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Nouveau mot de passe</h1>
      <form onSubmit={handleConfirm} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="password" className={styles.fieldLabel}>
            Nouveau mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={styles.input}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Mise à jour…" : "Mettre à jour le mot de passe"}
        </button>
      </form>
    </div>
  );
}
