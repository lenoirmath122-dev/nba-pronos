"use client";

import { useState, useTransition } from "react";
import { deleteBet } from "@/lib/actions/bets";
import { FocusTrap } from "@/components/ui/FocusTrap";
import styles from "./DeleteBetButton.module.css";

// Suppression d'un pari encore modifiable (18/08/2026, demandé par
// l'utilisateur) — même patron que components/admin/DeleteMatchButton.tsx
// (dialogue de confirmation, action non réversible côté joueur). Sous le
// capot, lib/actions/bets.ts::deleteBet passe le pari en CANCELLED (rétention
// D2) : le libellé "Supprimer" reste honnête côté produit (le pari sort bien
// de "Mes paris" en cours et libère son emplacement), même si la ligne
// persiste en base.

type DeleteBetButtonProps = {
  betId: string;
};

export function DeleteBetButton({ betId }: DeleteBetButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBet(betId);
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
          <FocusTrap
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-bet-title"
            onClose={() => setShowConfirm(false)}
          >
            <p id="delete-bet-title" className={styles.dialogTitle}>
              Supprimer ce pari ?
            </p>
            <p className={styles.dialogBody}>
              Il sort de tes paris en cours et libère son emplacement. Irréversible.
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
          </FocusTrap>
        </div>
      )}
    </div>
  );
}
