"use client";

import { useState } from "react";
import { regenerateRecoveryCodes, signOutOtherSessions } from "@/lib/actions/mfa";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import type { AdminSession } from "@/lib/actions/mfa";
import styles from "@/app/(admin)/admin/security/page.module.css";

export function SecurityScreen({ sessions }: { sessions: AdminSession[] }) {
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [regenPending, setRegenPending] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleRegenerate() {
    setRegenError(null);
    setRegenPending(true);
    const result = await regenerateRecoveryCodes();
    setRegenPending(false);
    if (!result.success) {
      setRegenError(result.error);
      return;
    }
    setRecoveryCodes(result.data.recoveryCodes);
  }

  async function handleSignOutOthers() {
    setSignOutError(null);
    setSignOutMessage(null);
    setSignOutPending(true);
    const result = await signOutOtherSessions();
    setSignOutPending(false);
    if (!result.success) {
      setSignOutError(result.error);
      return;
    }
    setSignOutMessage("Toutes les autres sessions ont été déconnectées.");
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Sécurité du compte</h1>

      <section className={`${styles.section} glass-card`}>
        <h2 className={styles.sectionTitle}>Codes de récupération</h2>
        <p className={styles.helpText}>
          Régénérer invalide immédiatement tous les anciens codes, y compris ceux jamais utilisés.
        </p>
        {recoveryCodes ? (
          <>
            <ul className={styles.recoveryList}>
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className={styles.recoveryWarning}>Ils ne seront plus jamais affichés après cette page.</p>
          </>
        ) : (
          <button type="button" onClick={handleRegenerate} disabled={regenPending} className={styles.button}>
            {regenPending ? "Génération…" : "Régénérer mes codes de récupération"}
          </button>
        )}
        {regenError && (
          <p role="alert" className={styles.error}>
            {regenError}
          </p>
        )}
      </section>

      <section className={`${styles.section} glass-card`}>
        <h2 className={styles.sectionTitle}>Sessions connectées</h2>
        {sessions.length === 0 ? (
          <p className={styles.helpText}>Aucune session active.</p>
        ) : (
          <ul className={styles.sessionList}>
            {sessions.map((s) => (
              <li key={s.id} className={styles.sessionRow}>
                <span>{s.userAgent ?? "Appareil inconnu"}</span>
                <span>Dernière activité : {parisDateTimeLabel(s.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={handleSignOutOthers} disabled={signOutPending} className={styles.button}>
          {signOutPending ? "Déconnexion…" : "Déconnecter toutes les autres sessions"}
        </button>
        {signOutMessage && <p className={styles.success}>{signOutMessage}</p>}
        {signOutError && (
          <p role="alert" className={styles.error}>
            {signOutError}
          </p>
        )}
      </section>
    </div>
  );
}
