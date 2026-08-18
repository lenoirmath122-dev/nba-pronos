"use client";

import { useState, useTransition } from "react";
import { validateAllCompleteMatchPredictions } from "@/lib/actions/matches";
import styles from "./ValidateAllBanner.module.css";

// Bandeau « Tout valider » (§9) — feuille client n°3/3 : porte le dialogue de
// confirmation (état local, la page qui l'appelle reste serveur). N'apparaît
// (rendu par la page) que s'il existe au moins un brouillon COMPLET
// (readyCount > 0) ; ne compte QUE les "prêt", jamais les incomplets ni les
// déjà validés. La confirmation liste les matchs concernés et rappelle
// l'irréversibilité, affichée AVANT l'appel (l'action elle-même ne confirme
// rien, T6b §3.1).
type ReadyMatch = { matchId: string; label: string };

type ValidateAllBannerProps = { readyMatches: ReadyMatch[] };

export function ValidateAllBanner({ readyMatches }: ValidateAllBannerProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await validateAllCompleteMatchPredictions();
      setIsConfirmOpen(false);
    });
  }

  const count = readyMatches.length;

  return (
    <div className={styles.banner}>
      <p className={styles.text}>
        {count} prono{count > 1 ? "s" : ""} prêt{count > 1 ? "s" : ""} à valider
      </p>
      <button type="button" className={styles.cta} onClick={() => setIsConfirmOpen(true)}>
        Tout valider
      </button>

      {isConfirmOpen && (
        <div className={styles.backdrop} role="presentation">
          <div
            className={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="validate-all-title"
          >
            <p id="validate-all-title" className={styles.dialogTitle}>
              Valider {count} prono{count > 1 ? "s" : ""} ?
            </p>
            <ul className={styles.matchList}>
              {readyMatches.map((m) => (
                <li key={m.matchId}>{m.label}</li>
              ))}
            </ul>
            <p className={styles.dialogWarning}>
              Une fois validés, ces pronos ne sont plus modifiables — et tu verras (comme les autres joueurs) les
              pronos déjà déposés sur ces matchs.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={() => setIsConfirmOpen(false)}
                disabled={isPending}
              >
                Annuler
              </button>
              <button type="button" className={styles.dialogConfirm} onClick={handleConfirm} disabled={isPending}>
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
