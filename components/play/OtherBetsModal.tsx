"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { OtherBet } from "@/lib/queries/play";
import { FocusTrap } from "@/components/ui/FocusTrap";
import styles from "./OtherBetsModal.module.css";

// Révélation publique des paris (0.2.4 §9) — déclencheur + popup, données
// déjà chargées côté serveur (RLS bet_is_public() a fait le tri, jamais
// re-filtré ici, C-6). Ex-components/my-predictions/OtherBetsModal.tsx.

type OtherBetsModalProps = { bets: OtherBet[] };

export function OtherBetsModal({ bets }: OtherBetsModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        Voir les paris des autres joueurs
      </button>

      {open &&
        createPortal(
          <div className={styles.backdrop} role="presentation" onClick={() => setOpen(false)}>
          <FocusTrap
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="other-bets-title"
            onClick={(e) => e.stopPropagation()}
            onClose={() => setOpen(false)}
          >
            <p id="other-bets-title" className={styles.title}>
              Paris des autres joueurs
            </p>

            {bets.length === 0 ? (
              <p className={styles.empty}>Personne d&rsquo;autre n&rsquo;a parié.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Joueur</th>
                    <th className={styles.th}>Pari</th>
                  </tr>
                </thead>
                <tbody>
                  {bets.map((bet) => (
                    <tr key={bet.userId}>
                      <td className={styles.td}>{bet.userName}</td>
                      <td className={styles.td}>{bet.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button type="button" className={styles.close} onClick={() => setOpen(false)}>
              Fermer
            </button>
          </FocusTrap>
        </div>,
        document.body
      )}
    </>
  );
}
