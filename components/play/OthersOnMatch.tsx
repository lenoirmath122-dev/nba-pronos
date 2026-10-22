"use client";

import type { OtherBet, OtherPrediction, RevealedPrediction } from "@/lib/queries/play";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { BetStatusPill, possiblePointsLabel } from "./BetBlock";
import { RevealPanelUpcoming } from "./RevealPanelUpcoming";
import styles from "./OthersOnMatch.module.css";

// Pronos ET paris des autres joueurs sur un match verrouillé, derrière un
// seul bouton (p3-6, retour alpha #12 : l'ancien panneau <details> des pronos
// + le bouton séparé des paris prenaient trop de place dans la carte).
// Fusion de l'ex-RevealPanelLocked.tsx et de l'ex-OtherBetsModal.tsx. Données
// déjà chargées côté serveur : la RLS révèle tout sur un match verrouillé
// (pronos) et bet_is_public() a déjà fait le tri (paris), jamais re-filtré
// ici (C-6). Chaque pari montre aussi son statut, ses points et sa proba
// calculée (retour alpha #15).

// Contrôlée (open/onClose) depuis le 22/10/2026 : plus de bouton propre, la
// zone « Mon pari » et l'icône « personnes » des cartes l'ouvrent. Deux modes :
// match verrouillé (tout est révélé) ou à venir (pronos des autres seulement
// si mon prono est validé, paris révélés au coup d'envoi).
type OthersOnMatchProps = { open: boolean; onClose: () => void } & (
  | {
      mode: "locked";
      others: RevealedPrediction[];
      absenteeCount: number;
      bets: OtherBet[];
    }
  | {
      mode: "upcoming";
      isRevealed: boolean;
      predictedCount: number;
      eligibleCount: number;
      others: OtherPrediction[];
      absentees: string[];
    }
);

export function OthersOnMatch(props: OthersOnMatchProps) {
  if (!props.open) return null;

  if (props.mode === "upcoming") {
    return (
      <ModalDialog title="Les autres sur ce match" onClose={props.onClose}>
        <div className={styles.content}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Pronos</h2>
            <RevealPanelUpcoming
              isRevealed={props.isRevealed}
              predictedCount={props.predictedCount}
              eligibleCount={props.eligibleCount}
              others={props.others}
              absentees={props.absentees}
            />
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Paris</h2>
            <p className={styles.empty}>Les paris des autres seront visibles au coup d&rsquo;envoi.</p>
          </section>
        </div>
      </ModalDialog>
    );
  }

  const { others, absenteeCount, bets } = props;
  return (
    <ModalDialog title="Les autres sur ce match" onClose={props.onClose}>
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
                        {other.predictedWinner
                          ? `${other.predictedWinner.abbreviation} +${other.predictedMargin}`
                          : "—"}
                      </span>
                      <span className={styles.predictionPoints}>
                        {other.points === null ? "—" : `${other.points} pts`}
                      </span>
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
  );
}

function OtherBetItem({ bet }: { bet: OtherBet }) {
  const possiblePoints = possiblePointsLabel(bet.status, bet.pointsAtStake);
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
