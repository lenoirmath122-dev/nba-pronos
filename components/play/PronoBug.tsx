import type { CSSProperties, ReactNode } from "react";
import { broadcastBandColor } from "@/lib/labels/teamColors";
import styles from "./PronoBug.module.css";

// Bandeau du prono façon incrustation télé (05/10/2026, p3-8, retour alpha
// « moins rond, plus arena ») : remplace les pilules arrondies « BOS +3 ».
// Option B des maquettes (bandeau d'info en couleur de l'équipe
// pronostiquée), choisie par l'utilisateur, SANS logo dans le bloc « Mon
// prono » (doublon avec les logos de l'en-tête de la carte). Partagé par
// PredictionSummary (cartes verrouillées : Mes pronos en cours et
// Résultats) et UpcomingRow (prono validé avant le coup d'envoi).
//
// Pas de "✓" (retiré 22/08/2026, signalé par l'utilisateur -- affiché à côté
// du score RÉEL une fois le match joué, il donnait l'impression trompeuse que
// le prono avait été GAGNANT). "+" (pas "−", même correctif) : "CHI +4" =
// Chicago gagne avec 4 points d'écart.

type PronoBugProps = {
  /** Vainqueur pronostiqué + écart ; null = bande neutre `neutralLabel`. */
  pick: { abbreviation: string; margin: number } | null;
  /** Libellé de la bande neutre quand `pick` est null (« Pas de prono »...). */
  neutralLabel?: string;
  /** Texte de gauche du sous-bandeau (détail des points, mention...). */
  detail?: ReactNode;
  /** Total à droite du sous-bandeau. Sans `detail` ni `points`, pas de
   *  sous-bandeau. */
  points?: ReactNode;
};

export function PronoBug({ pick, neutralLabel, detail, points }: PronoBugProps) {
  const bandColor = pick ? broadcastBandColor(pick.abbreviation) : null;
  const hasSub = detail !== undefined || points !== undefined;
  return (
    // Libellé accessible d'un seul tenant (« Mon prono : BOS +3 ») plutôt
    // que « Mon », « prono », « BOS +3 » lus bloc par bloc.
    <div
      className={styles.bug}
      role="group"
      aria-label={pick ? `Mon prono : ${pick.abbreviation} +${pick.margin}` : neutralLabel}
    >
      <div className={styles.top}>
        <span className={styles.tag} aria-hidden="true">
          Mon
          <br />
          prono
        </span>
        {pick ? (
          <span
            className={styles.band}
            style={bandColor ? ({ "--team-color": bandColor } as CSSProperties) : undefined}
          >
            <span className={styles.title}>
              {pick.abbreviation} +{pick.margin}
            </span>
          </span>
        ) : (
          // Pas de rouge (T7/R-COL) : un prono manquant/incomplet n'est pas
          // un résultat négatif, juste un rappel neutre.
          <span className={`${styles.band} ${styles.neutral}`}>
            <span className={styles.title}>{neutralLabel}</span>
          </span>
        )}
      </div>
      {hasSub && (
        <div className={styles.sub}>
          <span className={styles.detail}>{detail}</span>
          {points !== undefined && <span className={styles.points}>{points}</span>}
        </div>
      )}
    </div>
  );
}
