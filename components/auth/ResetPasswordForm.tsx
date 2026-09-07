"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/browser";
import { requestPasswordReset } from "@/lib/auth/actions";
import { MailIcon } from "@/components/icons/auth-icons";
import { TurnstileWidget } from "./TurnstileWidget";
import styles from "./AuthScreen.module.css";

// Flux Supabase STANDARD (T2 §8, T6a arbre app/ — UNE seule route pour les 2
// étapes). La CONFIRMATION (choix du nouveau mot de passe) passe par le SDK
// client, aucune alternative possible : le lien reçu par email dépose un
// jeton dans l'URL (fragment `#access_token=...&type=recovery`) que le
// client navigateur (session en cookie, lib/supabase/browser.ts) détecte
// automatiquement au chargement — c'est CE signal (`onAuthStateChange`,
// événement `PASSWORD_RECOVERY`) qui bascule cette page de "demander un
// email" à "choisir un nouveau mot de passe", jamais un paramètre d'URL lu
// nous-mêmes. La DEMANDE (envoi de l'email), elle, passe par la server
// action requestPasswordReset() (lib/auth/actions.ts) depuis le 07/09/2026
// (p1-12, feuille de route Phase 1) — seul changement : un frein applicatif
// par IP manquait à ce formulaire (Turnstile déjà présent), impossible à
// poser sans passer par le serveur (l'IP du client ne peut pas s'auto-
// déclarer de façon fiable).
export function ResetPasswordForm() {
  const [mode, setMode] = useState<"checking" | "request" | "confirm">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [pending, setPending] = useState(false);
  // Compteur simple (pas de useActionState ici, cf. TurnstileWidget) : change
  // à chaque échec pour forcer le widget à générer un nouveau jeton, un
  // jeton Turnstile étant à usage unique.
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

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

  async function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    // Bug réel trouvé le 07/09/2026 (GAPS_OUVERTS.md, Phase 0) : ce flux
    // n'a jamais transmis de jeton Turnstile, contrairement à
    // LoginForm/SignupForm -- avec la protection CAPTCHA Supabase activée
    // au niveau du projet (pas seulement câblée app-side sur login/signup),
    // CHAQUE demande de réinitialisation échouait en silence côté serveur
    // (error_code "captcha_failed"), masqué par ce message générique.
    const captchaToken = String(new FormData(e.currentTarget).get("cf-turnstile-response") ?? "");
    const { error: resetError } = await requestPasswordReset(email, captchaToken);
    setPending(false);
    if (resetError) {
      setError(resetError);
      setTurnstileResetKey((key) => key + 1);
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
          <TurnstileWidget resetKey={turnstileResetKey} />
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
