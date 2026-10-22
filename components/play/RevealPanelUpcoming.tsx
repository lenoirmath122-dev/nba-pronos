import { useState } from "react";
import type { BetWithoutProno, OtherPrediction } from "@/lib/queries/play";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./RevealPanelUpcoming.module.css";

// Panneau "valider = voir" (§8 SPEC_ECRAN_MATCHS) — sans "use client" propre,
// rendu dans la popup de ParticipationTrigger (14/09/2026, ex-rendu direct
// par UpcomingRowForm avant sa fusion dans UpcomingRow.tsx). Le compteur X/N
// est TOUJOURS affiché ; le détail
// nominatif (others/absentees) n'arrive que si isRevealed — et dans ce cas,
// il est déjà VIDE côté serveur quand ce n'est pas le cas (lib/queries/play.ts),
// donc ce composant ne fait ici que rendre ce qu'on lui donne, jamais un filtrage.
type RevealPanelProps = {
  isRevealed: boolean;
  predictedCount: number;
  eligibleCount: number;
  others: OtherPrediction[];
  absentees: string[];
  betsWithoutProno?: BetWithoutProno[];
};

export function RevealPanelUpcoming({
  isRevealed,
  predictedCount,
  eligibleCount,
  others,
  absentees,
  betsWithoutProno = [],
}: RevealPanelProps) {
  const [showAbsentees, setShowAbsentees] = useState(false);

  return (
    <div className={styles.panel}>
      <p className={styles.counter}>
        <span className={styles.counterNumbers}>
          {predictedCount}/{eligibleCount}
        </span>{" "}
        ont pronostiqué
      </p>

      {!isRevealed ? <p className={styles.locked}>Valide ton prono pour voir ceux des autres.</p> : null}

      {betsWithoutProno.length > 0 && (
        <ul className={styles.list}>
          {betsWithoutProno.map((b) => (
            <li key={b.userId} className={styles.item}>
              <PlayerLink userId={b.userId} pseudo={b.pseudo} className={styles.pseudo} />
              <span className={styles.bet}>{b.description}</span>
            </li>
          ))}
        </ul>
      )}

      {isRevealed && (
        <>
          {others.length > 0 && (
            <ul className={styles.list}>
              {others.map((other) => (
                <li
                  key={other.userId}
                  className={other.isInactive ? `${styles.item} ${styles.itemInactive}` : styles.item}
                >
                  <PlayerLink userId={other.userId} pseudo={other.pseudo} className={styles.pseudo} />
                  <span className={styles.pick}>
                    {/* "+" pas "−" (22/08/2026, même correctif que
                        PredictionSummary.tsx) : margin est toujours l'écart
                        de victoire, jamais un déficit. */}
                    {other.teamAbbreviation} +{other.margin}
                  </span>
                  {other.adminCorrection && (
                    <span className={styles.correctedBadge}>
                      Saisi par {other.adminCorrection.adminName} à la demande de {other.pseudo}
                      {other.adminCorrection.reason ? ` — ${other.adminCorrection.reason}` : ""}
                    </span>
                  )}
                  {other.isInactive && <span className={styles.inactiveTag}>inactif</span>}
                  {other.bet && <span className={styles.bet}>{other.bet}</span>}
                </li>
              ))}
            </ul>
          )}

          {absentees.length > 0 && (
            <div className={styles.absentees}>
              <button
                type="button"
                className={styles.absenteesToggle}
                onClick={() => setShowAbsentees((v) => !v)}
                aria-expanded={showAbsentees}
              >
                {absentees.length} n&rsquo;ont pas joué
              </button>
              {showAbsentees && (
                <ul className={styles.absenteesList}>
                  {absentees.map((pseudo) => (
                    <li key={pseudo}>{pseudo}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
