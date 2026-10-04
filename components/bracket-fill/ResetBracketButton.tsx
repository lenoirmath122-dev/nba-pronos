"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { resetBracket } from "@/lib/actions/bracket-fill";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { Backdrop } from "@/components/ui/Backdrop";
import { useToast } from "@/components/ui/Toast";
import styles from "./ResetBracketButton.module.css";

// Remise à zéro du bracket personnel (17/08/2026, demandé par l'utilisateur)
// — rendu dans l'arbre de /play/bracket (FillPosterView ; l'ancienne vue en
// cartes BracketFillBoard a été retirée le 04/10/2026), même patron de
// dialogue de confirmation que DeleteMatchButton.tsx. Portalé vers
// document.body comme le dialogue de validation du parent.

type ResetBracketButtonProps = {
  onError: (message: string | null) => void;
};

export function ResetBracketButton({ onError }: ResetBracketButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function handleConfirm() {
    onError(null);
    startTransition(async () => {
      const result = await resetBracket();
      setShowConfirm(false);
      if (result.success) showToast("Bracket remis à zéro");
      else onError(result.error);
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
          <Backdrop className={styles.backdrop} onClose={() => setShowConfirm(false)}>
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
          </Backdrop>,
          document.body
        )}
    </>
  );
}
