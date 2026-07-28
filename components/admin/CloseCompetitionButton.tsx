"use client";

import { useState, useTransition } from "react";
import { closeCompetition } from "@/lib/actions/admin-competitions";
import styles from "./CloseCompetitionButton.module.css";

// Clôture et archivage (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1 §9, lot 3/3) —
// SEULE feuille "use client" de l'écran /admin/competitions, même patron
// que components/admin/RecalculateButton.tsx (dialogue de confirmation,
// action IRRÉVERSIBLE : aucune correction possible après clôture).

type CloseCompetitionButtonProps = {
  competitionId: string;
};

export function CloseCompetitionButton({ competitionId }: CloseCompetitionButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await closeCompetition(competitionId);
      setShowConfirm(false);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.closeButton} onClick={() => setShowConfirm(true)}>
        Clôturer et archiver
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {showConfirm && (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="close-competition-title">
            <p id="close-competition-title" className={styles.dialogTitle}>
              Clôturer cette compétition ?
            </p>
            <p className={styles.dialogBody}>
              Fige le classement final dans les archives et libère la place pour en créer une nouvelle.
              Irréversible : plus aucune correction ne sera possible après clôture.
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
                Clôturer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
