import type { MyPrediction } from "@/lib/queries/my-predictions";
import styles from "./PredictionSummary.module.css";

// Rendu de MON prono (§6/§8) — serveur, aucune action de saisie ici (§17,
// hors périmètre : le verrouillage au coup d'envoi est irréversible).

const STATE_LABEL: Record<MyPrediction["state"], string> = {
  FROZEN: "Prono figé",
  INCOMPLETE: "Brouillon incomplet",
  MISSING: "Pas de prono",
};

// Pas de rouge (T7/R-COL) : un prono manquant/incomplet n'est pas un résultat
// négatif, juste un rappel neutre — même principe que l'écran Matchs.
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
        // Requérant = MOI (propriétaire du prono), toujours — §7.1 : pas
        // besoin de lire correction_requests pour le savoir, contrairement au
        // panneau des AUTRES joueurs (RevealPanel) qui, lui, nomme la personne.
        <p className={styles.adminCorrection}>
          Saisi par {prediction.adminCorrection.adminName} à ta demande
          {prediction.adminCorrection.reason ? ` — ${prediction.adminCorrection.reason}` : ""}
        </p>
      )}

      <span className={styles.points}>
        {/* « — » tant que non scoré, jamais « 0 » (§9) */}
        {prediction.points === null ? "—" : `${prediction.points} pts`}
      </span>
    </div>
  );
}
