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

type PredictionSummaryProps = {
  prediction: MyPrediction;
  /** Points du pari associé à ce match (22/08/2026, demandé par
   *  l'utilisateur -- le total ici n'incluait jusque-là que le prono).
   *  null tant que non résolu (pas de pari, ou pari pas encore
   *  WON/LOST) -- même convention que prediction.points, jamais 0. */
  betPoints: number | null;
};

export function PredictionSummary({ prediction, betPoints }: PredictionSummaryProps) {
  // Total combiné prono + pari (22/08/2026) : le pari peut se résoudre
  // PLUS TARD que le prono (résolution manuelle admin, pas encore
  // automatique -- voir GAPS_OUVERTS.md) -- betPoints ?? 0 pour ne pas
  // bloquer l'affichage du total prono en attendant, mais jamais mentionné
  // dans le détail entre parenthèses tant qu'il reste null (pas encore
  // acquis, à ne pas confondre avec un pari qui aurait rapporté 0).
  //
  // Bug réel trouvé le 25/08/2026 (test étape 5, résolution auto) :
  // `prediction.points === null ? null : ...` masquait aussi le cas
  // INVERSE -- pas de prono du tout (state=MISSING, points toujours null)
  // mais un pari résolu (betPoints non-null) affichait quand même "—",
  // les points du pari disparaissant purement et simplement. Le total ne
  // doit être null QUE si prono ET pari sont TOUS LES DEUX absents.
  const hasPredictionPoints = prediction.points !== null;
  const totalPoints = hasPredictionPoints || betPoints !== null ? (prediction.points ?? 0) + (betPoints ?? 0) : null;
  return (
    <div className={styles.summary}>
      <span className={`${styles.state} ${STATE_CLASS[prediction.state]}`}>
        {prediction.state === "FROZEN" && prediction.predictedWinner
          ? // Pas de "✓" ici (retiré 22/08/2026, signalé par l'utilisateur --
            // affiché à côté du score RÉEL une fois le match joué, il donnait
            // l'impression trompeuse que le prono avait été GAGNANT, alors
            // qu'il ne fait que rappeler ce qui a été pronostiqué -- correct
            // ou pas ne se lit qu'en comparant au score, pas via ce symbole).
            // "+" (pas "−", même correctif) : "CHI +4" = Chicago gagne avec 4
            // points d'écart.
            `${prediction.predictedWinner.abbreviation} +${prediction.predictedMargin}`
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
        {totalPoints === null ? (
          "—"
        ) : (
          <>
            {totalPoints} pts
            {/* Détail demandé par l'utilisateur (18/08/2026) : vainqueur/écart
                toujours les 2 ensemble (même passe de scoring que `points`),
                y compris à 0 — ce n'est pas "non scoré", juste une composante
                nulle d'un total qui, lui, est bien acquis. "pari" ajouté
                (22/08/2026) UNIQUEMENT une fois résolu -- betPoints à 0 se
                distingue ainsi d'un pari pas encore joué (absent du détail).
                hasPredictionPoints ajouté (25/08/2026, même bug que ci-dessus)
                -- sans prono du tout, winnerPoints/marginPoints sont null,
                les afficher littéralement aurait affiché "null pronostic,
                null écart" au lieu d'omettre proprement cette partie. */}
            <span className={styles.pointsDetail}>
              {" "}
              (
              {hasPredictionPoints && `${prediction.winnerPoints} pronostic, ${prediction.marginPoints} écart`}
              {hasPredictionPoints && betPoints !== null && ", "}
              {betPoints !== null && `${betPoints} pari`}
              )
            </span>
          </>
        )}
      </span>
    </div>
  );
}
