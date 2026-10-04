"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

// Confirmation brève d'une action réussie (04/10/2026, p3-5 — retour de
// l'alpha : « voir que ça charge, puis une confirmation à l'enregistrement »).
// Avant ça, un pari soumis refermait sa popup sans un mot, un brouillon
// s'enregistrait sans aucun signe visible.
//
// Un seul toast à la fois : un nouveau remplace le précédent (deux actions
// rapprochées n'ont pas à s'empiler). Région `role="status"` toujours montée,
// sinon un lecteur d'écran n'annonce pas un texte inséré en même temps que
// son conteneur. Succès uniquement : les erreurs restent affichées en ligne,
// à côté du bouton qui a échoué (role="alert" déjà en place partout).
//
// Monté par la coquille de la zone joueur (app/(app)/layout.tsx). Hors de
// cette zone, `useToast()` renvoie une fonction sans effet plutôt que de
// planter — un composant partagé peut l'appeler sans savoir où il est rendu.

const TOAST_DURATION_MS = 2600;

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

const noop: ShowToast = () => {};

export function useToast(): ShowToast {
  return useContext(ToastContext) ?? noop;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // `id` change à chaque appel : sert de `key` pour rejouer l'animation
  // d'entrée même si le même message revient deux fois de suite.
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const nextIdRef = useRef(0);

  const showToast = useCallback<ShowToast>((message) => {
    nextIdRef.current += 1;
    setToast({ id: nextIdRef.current, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toast && (
          <div key={toast.id} className={styles.toast}>
            <svg className={styles.check} viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <circle cx="10" cy="10" r="9" className={styles.checkCircle} />
              <path d="M5.5 10.5l3 3 6-6.5" className={styles.checkMark} />
            </svg>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
