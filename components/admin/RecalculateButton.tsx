"use client";

import { useState, useTransition } from "react";
import { recalculateCompetition } from "@/lib/actions/admin";
import styles from "./RecalculateButton.module.css";

// SEULE feuille "use client" du tableau de bord (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1
// §4) — le reste de l'écran reste composant serveur. Dialogue de
// confirmation même patron que components/bracket-fill/BracketFillBoard.tsx
// (déjà le patron cité par la spec).

type RecalculateButtonProps = {
  disabled: boolean;
};

export function RecalculateButton({ disabled }: RecalculateButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await recalculateCompetition();
      setShowConfirm(false);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.recalculateButton}
        disabled={disabled}
        title={disabled ? "Aucune compétition active" : undefined}
        onClick={() => setShowConfirm(true)}
      >
        Recalculer
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {showConfirm && (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="recalculate-title">
            <p id="recalculate-title" className={styles.dialogTitle}>
              Recalculer tous les scores ?
            </p>
            <p className={styles.dialogBody}>
              Rejoue le barème complet de la compétition active. Sans risque —
              l&rsquo;opération est idempotente (aucun double comptage) — mais
              peut prendre quelques secondes.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
              >
                Annuler
              </button>
              <button type="button" className={styles.dialogConfirm} onClick={handleConfirm} disabled={isPending}>
                Recalculer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
