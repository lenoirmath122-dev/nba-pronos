"use client";

import { useState } from "react";
import type { OtherBet, RevealedPrediction } from "@/lib/queries/play";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { BetStatusPill, possiblePointsLabel } from "./BetBlock";
import styles from "./OthersOnMatch.module.css";

// Pronos ET paris des autres joueurs sur un match verrouillé, derrière un
// seul bouton (p3-6, retour alpha #12 : l'ancien panneau <details> des pronos
// + le bouton séparé des paris prenaient trop de place dans la carte).
// Fusion de l'ex-RevealPanelLocked.tsx et de l'ex-OtherBetsModal.tsx. Données
// déjà chargées côté serveur : la RLS révèle tout sur un match verrouillé
// (pronos) et bet_is_public() a déjà fait le tri (paris), jamais re-filtré
// ici (C-6). Chaque pari montre aussi son statut, ses points et sa proba
// calculée (retour alpha #15).

type OthersOnMatchProps = {
  others: RevealedPrediction[];
  absenteeCount: number;
  bets: OtherBet[];
};

export function OthersOnMatch({ others, absenteeCount, bets }: OthersOnMatchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const count = others.length + bets.length;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        Pronos et paris des autres{count > 0 ? ` (${count})` : ""}
      </button>

      {isOpen && (
        <ModalDialog title="Les autres sur ce match" onClose={() => setIsOpen(false)}>
          <div className={styles.content}>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Pronos</h2>
              {others.length === 0 && absenteeCount === 0 ? (
                <p className={styles.empty}>Personne d&rsquo;autre n&rsquo;a pronostiqué sur ce match.</p>
              ) : (
                <>
                  {others.length > 0 && (
                    <ul className={styles.list}>
                      {others.map((other) => (
                        <li key={other.userId} className={styles.predictionItem}>
                          <PlayerLink userId={other.userId} pseudo={other.userName} className={styles.pseudo} />
                          <span className={styles.pick}>
                            {/* "+" pas "−" : predictedMargin est toujours
                                l'écart de victoire, jamais un déficit. */}
                            {other.predictedWinner ? `${other.predictedWinner.abbreviation} +${other.predictedMargin}` : "—"}
                          </span>
                          <span className={styles.predictionPoints}>{other.points === null ? "—" : `${other.points} pts`}</span>
                          {other.adminCorrection && (
                            <span className={styles.correctedBadge}>
                              Saisi par {other.adminCorrection.adminName} à la demande de {other.userName}
                              {other.adminCorrection.reason ? ` — ${other.adminCorrection.reason}` : ""}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {absenteeCount > 0 && (
                    <p className={styles.empty}>
                      {absenteeCount} n&rsquo;{absenteeCount > 1 ? "ont" : "a"} pas pronostiqué
                    </p>
                  )}
                </>
              )}
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Paris</h2>
              {bets.length === 0 ? (
                <p className={styles.empty}>Personne d&rsquo;autre n&rsquo;a parié.</p>
              ) : (
                <ul className={styles.list}>
                  {bets.map((bet) => (
                    <OtherBetItem key={bet.userId} bet={bet} />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </ModalDialog>
      )}
    </>
  );
}

function OtherBetItem({ bet }: { bet: OtherBet }) {
  const possiblePoints = possiblePointsLabel(bet.status, bet.difficulty);
  const isCancelled = bet.status === "CANCELLED";
  const wonPoints = bet.status === "WON" ? bet.pointsAwarded : null;

  return (
    <li className={styles.betItem}>
      <div className={styles.betHeader}>
        <PlayerLink userId={bet.userId} pseudo={bet.userName} className={styles.pseudo} />
        <BetStatusPill status={bet.status} />
      </div>
      <p className={isCancelled ? `${styles.betDescription} ${styles.betDescriptionCancelled}` : styles.betDescription}>
        {bet.description}
      </p>
      {(wonPoints !== null || possiblePoints || bet.calculatedProba !== null) && (
        <p className={styles.betMeta}>
          {wonPoints !== null && <span className={styles.betPointsWon}>+{wonPoints} pts</span>}
          {possiblePoints && <span>{possiblePoints}</span>}
          {bet.calculatedProba !== null && <span>Proba calculée : {Math.round(bet.calculatedProba * 100)}%</span>}
        </p>
      )}
    </li>
  );
}
