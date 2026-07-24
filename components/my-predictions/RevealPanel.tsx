import type { RevealedPrediction } from "@/lib/queries/my-predictions";
import styles from "./RevealPanel.module.css";

// Panneau déplié (§7) — <details> natif, rendu SERVEUR, contenu déjà chargé
// (jamais de fuite : sur un match verrouillé la RLS révèle déjà tout à tout le
// monde, §12). Le repli est purement visuel, pas une frontière de
// confidentialité — à la différence de l'écran Matchs.

type RevealPanelProps = {
  others: RevealedPrediction[];
  absenteeCount: number;
};

export function RevealPanel({ others, absenteeCount }: RevealPanelProps) {
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
                  <span className={styles.pseudo}>{other.userName}</span>
                  <span className={styles.pick}>
                    {other.predictedWinner ? `${other.predictedWinner.abbreviation} −${other.predictedMargin}` : "—"}
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
