"use client";

import { useState } from "react";
import { verifyMfaChallenge, verifyRecoveryCode } from "@/lib/actions/mfa";
import styles from "./MfaScreen.module.css";

export function MfaChallengeForm() {
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = mode === "totp" ? await verifyMfaChallenge(code) : await verifyRecoveryCode(code);
    if (!result.success) {
      setPending(false);
      setError(result.error);
      return;
    }
    // Rechargement complet (pas de router.push) : admin/layout.tsx doit
    // relire la session/le cookie côté serveur avec l'AAL/la session de
    // secours à jour, pas un cache RSC potentiellement antérieur.
    window.location.href = "/admin";
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Vérification en deux étapes</h1>
      <p className={styles.helpText}>
        {mode === "totp"
          ? "Saisis le code affiché dans ton appli d'authentification."
          : "Saisis un de tes codes de récupération à usage unique."}
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="code" className={styles.fieldLabel}>
            {mode === "totp" ? "Code à 6 chiffres" : "Code de récupération"}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={styles.input}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Vérification…" : "Valider"}
        </button>
      </form>
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => {
          setMode((m) => (m === "totp" ? "recovery" : "totp"));
          setCode("");
          setError(null);
        }}
      >
        {mode === "totp" ? "J'ai perdu l'accès à mon appli d'authentification" : "Revenir au code de l'appli"}
      </button>
    </div>
  );
}
