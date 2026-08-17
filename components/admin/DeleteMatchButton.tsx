"use client";

import { useState, useTransition } from "react";
import { deleteMatch } from "@/lib/actions/admin-results";
import styles from "./DeleteMatchButton.module.css";

// Suppression d'un match (17/08/2026, demandé par l'utilisateur — matchs
// ajoutés avec une heure déjà passée par erreur de fuseau, aucun moyen de
// les retirer jusqu'ici) — même patron que CloseCompetitionButton.tsx
// (dialogue de confirmation, action IRRÉVERSIBLE). L'action serveur
// (lib/actions/admin-results.ts::deleteMatch) refuse la suppression si des
// pronostics/paris existent déjà sur ce match — jamais de perte silencieuse.

type DeleteMatchButtonProps = {
  matchId: string;
  matchLabel: string;
};

export function DeleteMatchButton({ matchId, matchLabel }: DeleteMatchButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteMatch(matchId);
      setShowConfirm(false);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.deleteButton} onClick={() => setShowConfirm(true)}>
        Supprimer
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {showConfirm && (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-match-title">
            <p id="delete-match-title" className={styles.dialogTitle}>
              Supprimer {matchLabel} ?
            </p>
            <p className={styles.dialogBody}>
              Irréversible. Refusé automatiquement si des pronostics ou paris existent déjà sur ce match.
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
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
