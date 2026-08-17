"use client";

import { createPortal } from "react-dom";
import styles from "./ModalDialog.module.css";

// Fenêtre centrée générique (17/08/2026, extraite de
// components/bets/BetFormModal.tsx pour être réutilisée par
// InlineBetForm.tsx en mode "modal" — même coquille visuelle, seul le sens
// de `onClose` diffère : BetFormModal ferme via `router.back()` (le
// formulaire est une VRAIE page), InlineBetForm via un simple `setIsOpen
// (false)` (le formulaire est une pop-up sur une carte, pas une navigation).
// Portalée vers document.body : échappe à tout contexte d'empilement
// ancestral (ex. .photo-page), même raison que les autres dialogues du
// projet (DeleteMatchButton, ResetBracketButton...).

type ModalDialogProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function ModalDialog({ title, onClose, children }: ModalDialogProps) {
  return createPortal(
    <div className={styles.backdrop} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="modal-dialog-title">
        <div className={styles.header}>
          <p id="modal-dialog-title" className={styles.title}>
            {title}
          </p>
          <button type="button" className={styles.close} onClick={onClose}>
            × Fermer
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
