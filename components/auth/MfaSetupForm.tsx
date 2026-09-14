"use client";

import { useEffect, useState } from "react";
import { startMfaEnrollment, confirmMfaEnrollment } from "@/lib/actions/mfa";
import styles from "./MfaScreen.module.css";

type Step =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "enroll"; factorId: string; qrCode: string; secret: string }
  | { name: "done"; recoveryCodes: string[] };

export function MfaSetupForm() {
  const [step, setStep] = useState<Step>({ name: "loading" });
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    startMfaEnrollment().then((result) => {
      if (!result.success) {
        setStep({ name: "error", message: result.error });
        return;
      }
      setStep({ name: "enroll", ...result.data });
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step.name !== "enroll") return;
    setFormError(null);
    setPending(true);
    const result = await confirmMfaEnrollment(step.factorId, code);
    setPending(false);
    if (!result.success) {
      setFormError(result.error);
      return;
    }
    setStep({ name: "done", recoveryCodes: result.data.recoveryCodes });
  }

  if (step.name === "loading") {
    return (
      <div className={`${styles.card} glass-card`}>
        <p className={styles.helpText}>Chargement…</p>
      </div>
    );
  }

  if (step.name === "error") {
    return (
      <div className={`${styles.card} glass-card`}>
        <h1 className={styles.cardTitle}>2FA obligatoire</h1>
        <p role="alert" className={styles.error}>
          {step.message}
        </p>
      </div>
    );
  }

  if (step.name === "done") {
    return (
      <div className={`${styles.card} glass-card`}>
        <h1 className={styles.cardTitle}>2FA activée</h1>
        <p className={styles.helpText}>
          Note ces codes de récupération quelque part hors ligne (papier, gestionnaire de mots de passe).
          Chacun ne fonctionne qu&apos;une fois, et te permet de retrouver l&apos;accès admin si tu perds ton
          téléphone.
        </p>
        <ul className={styles.recoveryList}>
          {step.recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className={styles.recoveryWarning}>Ils ne seront plus jamais affichés après cette page.</p>
        <a href="/admin" className={styles.submit} style={{ textAlign: "center", textDecoration: "none" }}>
          J&apos;ai noté mes codes, continuer
        </a>
      </div>
    );
  }

  return (
    <div className={`${styles.card} glass-card`}>
      <h1 className={styles.cardTitle}>Active la 2FA</h1>
      <p className={styles.helpText}>
        Le compte admin a accès à toutes les données du jeu — une double authentification est obligatoire
        avant de continuer. Scanne ce QR code avec une appli comme Google Authenticator ou Authy.
      </p>
      <div className={styles.qrWrap}>
        {/* SVG renvoyé tel quel par Supabase (auth.mfa.enroll) — pas d'image
            distante à charger, encodé en data URI pour un <img> classique. */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(step.qrCode)}`} alt="Code QR de la 2FA" />
      </div>
      <p className={styles.secret}>Ou saisis ce code manuellement : {step.secret}</p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="code" className={styles.fieldLabel}>
            Code à 6 chiffres
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={styles.input}
          />
        </div>
        {formError && (
          <p role="alert" className={styles.error}>
            {formError}
          </p>
        )}
        <button type="submit" disabled={pending} className={styles.submit}>
          {pending ? "Vérification…" : "Activer"}
        </button>
      </form>
    </div>
  );
}
