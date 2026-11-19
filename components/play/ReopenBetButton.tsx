"use client";

import { useState, useTransition } from "react";
import { reopenBet } from "@/lib/actions/bets";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { Backdrop } from "@/components/ui/Backdrop";
import dialog from "@/components/bets/DeleteBetButton.module.css";
import zone from "./MatchBetZone.module.css";

// « Modifier » (petit bouton carré à côté du pari) : un pari validé repasse en brouillon, une seule fois
// par match (SQL : reopen_bet, table bet_reopenings). Dialogue de confirmation
// calqué sur DeleteBetButton : l'action consomme la modification unique.

type Props = {
  betId: string;
  onReopened: (betId: string) => void;
  /** Erreur affichée par le parent (le bouton est placé dans la ligne du pari). */
  onError: (error: string | null) => void;
};

export function ReopenBetButton({ betId, onReopened, onError }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    onError(null);
    startTransition(async () => {
      const result = await reopenBet(betId);
      setShowConfirm(false);
      if (result.success) onReopened(betId);
      else onError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        className={zone.editSquare}
        onClick={() => setShowConfirm(true)}
        aria-label="Modifier mon pari"
      >
        Modifier
      </button>

      {showConfirm && (
        <Backdrop className={dialog.backdrop} onClose={() => setShowConfirm(false)}>
          <FocusTrap
            className={dialog.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reopen-bet-title"
            onClose={() => setShowConfirm(false)}
          >
            <p id="reopen-bet-title" className={dialog.dialogTitle}>
              Modifier ce pari ?
            </p>
            <p className={dialog.dialogBody}>
              Tu ne pourras modifier ce pari qu&rsquo;une seule fois. Il repasse en brouillon : pense à le
              resoumettre avant le coup d&rsquo;envoi, sinon tu n&rsquo;auras pas de pari sur ce match.
            </p>
            <div className={dialog.dialogActions}>
              <button
                type="button"
                className={dialog.dialogCancel}
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
              >
                Annuler
              </button>
              <button type="button" className={dialog.dialogConfirm} onClick={handleConfirm} disabled={isPending}>
                Modifier
              </button>
            </div>
          </FocusTrap>
        </Backdrop>
      )}
    </>
  );
}
