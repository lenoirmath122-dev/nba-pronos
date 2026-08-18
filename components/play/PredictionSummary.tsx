import type { MyPrediction } from "@/lib/queries/play";
import styles from "./PredictionSummary.module.css";

// Rendu de MON prono sur une ligne verrouillée — serveur, aucune action de
// saisie ici (le verrouillage au coup d'envoi est irréversible). Ex-
// components/my-predictions/PredictionSummary.tsx.

const STATE_LABEL: Record<MyPrediction["state"], string> = {
  FROZEN: "Prono figé",
  INCOMPLETE: "Brouillon incomplet",
  MISSING: "Pas de prono",
};

// Pas de rouge (T7/R-COL) : un prono manquant/incomplet n'est pas un résultat
// négatif, juste un rappel neutre.
const STATE_CLASS: Record<MyPrediction["state"], string> = {
  FROZEN: styles.stateFrozen,
  INCOMPLETE: styles.stateIncomplete,
  MISSING: styles.stateMissing,
};

type PredictionSummaryProps = { prediction: MyPrediction };

export function PredictionSummary({ prediction }: PredictionSummaryProps) {
  return (
    <div className={styles.summary}>
      <span className={`${styles.state} ${STATE_CLASS[prediction.state]}`}>
        {prediction.state === "FROZEN" && prediction.predictedWinner
          ? `✓ ${prediction.predictedWinner.abbreviation} −${prediction.predictedMargin}`
          : STATE_LABEL[prediction.state]}
      </span>

      {prediction.adminCorrection && (
        <p className={styles.adminCorrection}>
          Saisi par {prediction.adminCorrection.adminName} à ta demande
          {prediction.adminCorrection.reason ? ` — ${prediction.adminCorrection.reason}` : ""}
        </p>
      )}

      <span className={styles.points}>
        {/* "—" tant que non scoré, jamais "0" */}
        {prediction.points === null ? "—" : `${prediction.points} pts`}
      </span>
    </div>
  );
}
