"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { resetBracket } from "@/lib/actions/bracket-fill";
import { FocusTrap } from "@/components/ui/FocusTrap";
import styles from "./ResetBracketButton.module.css";

// Remise à zéro du bracket personnel (17/08/2026, demandé par l'utilisateur)
// — partagé entre les 2 rendus de l'écran /play/bracket (BracketFillBoard,
// mobile portrait ; FillPosterView, poster desktop/paysage), même patron de
// dialogue de confirmation que DeleteMatchButton.tsx. Portalé vers
// document.body comme les dialogues de validation des 2 parents : ce sont
// leurs propres contextes d'empilement (.photo-page) qui l'exigent.

type ResetBracketButtonProps = {
  onError: (message: string | null) => void;
};

export function ResetBracketButton({ onError }: ResetBracketButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    onError(null);
    startTransition(async () => {
      const result = await resetBracket();
      setShowConfirm(false);
      if (!result.success) onError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.resetButton}
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
      >
        Remettre à zéro
      </button>

      {showConfirm &&
        createPortal(
          <div className={styles.backdrop} role="presentation">
            <FocusTrap
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="reset-bracket-title"
              onClose={() => setShowConfirm(false)}
            >
              <p id="reset-bracket-title" className={styles.dialogTitle}>
                Remettre ton bracket à zéro ?
              </p>
              <p className={styles.dialogBody}>
                Tous tes picks (vainqueurs et scores) seront effacés et ton bracket redevient non validé.
                Irréversible.
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
                  Remettre à zéro
                </button>
              </div>
            </FocusTrap>
          </div>,
          document.body
        )}
    </>
  );
}
