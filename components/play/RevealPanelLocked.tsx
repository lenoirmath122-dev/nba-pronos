import type { RevealedPrediction } from "@/lib/queries/play";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./RevealPanelLocked.module.css";

// Panneau déplié des pronos des autres sur une ligne verrouillée — <details>
// natif, rendu SERVEUR, contenu déjà chargé (jamais de fuite : la RLS révèle
// déjà tout à tout le monde sur un match verrouillé). Le repli est purement
// visuel. Ex-components/my-predictions/RevealPanel.tsx.

type RevealPanelProps = {
  others: RevealedPrediction[];
  absenteeCount: number;
};

export function RevealPanelLocked({ others, absenteeCount }: RevealPanelProps) {
  const isEmpty = others.length === 0 && absenteeCount === 0;

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>Voir les pronos des autres</summary>

      {isEmpty ? (
        <p className={styles.empty}>Personne d&rsquo;autre n&rsquo;a pronostiqué sur ce match.</p>
      ) : (
        <>
          {others.length > 0 && (
            <ul className={styles.list}>
              {others.map((other) => (
                <li key={other.userId} className={styles.item}>
                  <PlayerLink userId={other.userId} pseudo={other.userName} className={styles.pseudo} />
                  <span className={styles.pick}>
                    {/* "+" pas "−" (22/08/2026, même correctif que
                        PredictionSummary.tsx) : predictedMargin est
                        toujours l'écart de victoire, jamais un déficit. */}
                    {other.predictedWinner ? `${other.predictedWinner.abbreviation} +${other.predictedMargin}` : "—"}
                  </span>
                  <span className={styles.points}>{other.points === null ? "—" : `${other.points} pts`}</span>
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
            <p className={styles.absentees}>
              {absenteeCount} n&rsquo;{absenteeCount > 1 ? "ont" : "a"} pas pronostiqué
            </p>
          )}
        </>
      )}
    </details>
  );
}
