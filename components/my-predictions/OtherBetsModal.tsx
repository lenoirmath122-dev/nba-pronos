"use client";

import { useState } from "react";
import type { OtherBet } from "@/lib/queries/my-predictions";
import styles from "./OtherBetsModal.module.css";

// Révélation publique des paris (0.2.4 §9, jamais construite avant ce lot) —
// SEULE feuille "use client" de ce bloc : un déclencheur + une popup, données
// déjà chargées côté serveur (RLS bet_is_public() a fait le tri, jamais
// re-filtré ici, C-6). Même patron de dialogue que
// components/admin/RecalculateButton.tsx (backdrop + div role="dialog"),
// adapté en lecture seule (pas de confirmation, juste "Fermer").

type OtherBetsModalProps = { bets: OtherBet[] };

export function OtherBetsModal({ bets }: OtherBetsModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        Voir les paris des autres joueurs
      </button>

      {open && (
        <div className={styles.backdrop} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="other-bets-title"
            onClick={(e) => e.stopPropagation()}
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
          </div>
        </div>
      )}
    </>
  );
}
