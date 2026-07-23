import { useState } from "react";
import type { OtherPrediction } from "@/lib/queries/matches";
import styles from "./RevealPanel.module.css";

// Panneau « valider = voir » (§8) — sans "use client" propre, rendu par
// PredictionForm. Le compteur X/N est TOUJOURS affiché ; le détail nominatif
// (others/absentees) n'arrive que si isRevealed — et dans ce cas, il est déjà
// VIDE côté serveur quand ce n'est pas le cas (lib/queries/matches.ts), donc
// ce composant ne fait ici que rendre ce qu'on lui donne, jamais un filtrage.
type RevealPanelProps = {
  isRevealed: boolean;
  predictedCount: number;
  eligibleCount: number;
  others: OtherPrediction[];
  absentees: string[];
};

export function RevealPanel({ isRevealed, predictedCount, eligibleCount, others, absentees }: RevealPanelProps) {
  const [showAbsentees, setShowAbsentees] = useState(false);

  return (
    <div className={styles.panel}>
      <p className={styles.counter}>
        <span className={styles.counterNumbers}>
          {predictedCount}/{eligibleCount}
        </span>{" "}
        ont pronostiqué
      </p>

      {!isRevealed ? (
        <p className={styles.locked}>Valide ton prono pour voir ceux des autres.</p>
      ) : (
        <>
          {others.length > 0 && (
            <ul className={styles.list}>
              {others.map((other) => (
                <li
                  key={other.pseudo}
                  className={other.isInactive ? `${styles.item} ${styles.itemInactive}` : styles.item}
                >
                  <span className={styles.pseudo}>{other.pseudo}</span>
                  <span className={styles.pick}>
                    {other.teamAbbreviation} −{other.margin}
                  </span>
                  {other.isAdminCorrected && <span className={styles.correctedBadge}>Corrigé par un admin</span>}
                  {other.isInactive && <span className={styles.inactiveTag}>inactif</span>}
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
