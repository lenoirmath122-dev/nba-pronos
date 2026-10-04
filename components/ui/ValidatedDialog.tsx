"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { FocusTrap } from "./FocusTrap";
import { Backdrop } from "./Backdrop";
import styles from "./ValidatedDialog.module.css";

// Popup « Pari validé » (04/10/2026, demandé par l'utilisateur après p3-5 :
// le toast seul passait trop inaperçu au moment qui compte le plus). Rappelle
// CE qui vient d'être validé (prono, pari perso) et reste à l'écran jusqu'au
// « OK » — choix de l'utilisateur, plutôt qu'une fermeture automatique.
//
// Deux sources : le geste du joueur lui-même (valider un prono, Tout valider,
// pari perso auto-validé par l'IA) et la validation d'un pari par un admin,
// découverte au chargement suivant (ValidatedBetsWatcher.tsx).
//
// File d'attente : si deux validations arrivent pendant qu'une popup est
// ouverte, elles s'affichent l'une après l'autre plutôt que de s'écraser.
//
// Monté par la coquille de la zone joueur (app/(app)/layout.tsx), comme le
// toast ; hors de cette zone `useValidatedDialog()` ne fait rien.

export type ValidatedDialogContent = {
  title: string;
  items: string[];
  note?: string;
};

type ShowValidatedDialog = (content: ValidatedDialogContent) => void;

const ValidatedDialogContext = createContext<ShowValidatedDialog | null>(null);

const noop: ShowValidatedDialog = () => {};

export function useValidatedDialog(): ShowValidatedDialog {
  return useContext(ValidatedDialogContext) ?? noop;
}

export function ValidatedDialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<ValidatedDialogContent[]>([]);

  const show = useCallback<ShowValidatedDialog>((content) => {
    setQueue((current) => [...current, content]);
  }, []);

  const close = useCallback(() => setQueue((current) => current.slice(1)), []);

  const current = queue[0];

  return (
    <ValidatedDialogContext.Provider value={show}>
      {children}
      {current &&
        createPortal(
          <Backdrop className={styles.backdrop} onClose={close}>
            <FocusTrap
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="validated-dialog-title"
              onClose={close}
            >
              <svg className={styles.check} viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
                <circle cx="24" cy="24" r="22" className={styles.checkCircle} />
                <path d="M14 25l7 7 13-14" className={styles.checkMark} />
              </svg>
              <p id="validated-dialog-title" className={styles.title}>
                {current.title}
              </p>
              {current.items.length > 0 && (
                <ul className={styles.items}>
                  {current.items.map((item, index) => (
                    <li key={index} className={styles.item}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {current.note && <p className={styles.note}>{current.note}</p>}
              <button type="button" className={styles.ok} onClick={close}>
                OK
              </button>
            </FocusTrap>
          </Backdrop>,
          document.body
        )}
    </ValidatedDialogContext.Provider>
  );
}
