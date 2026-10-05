import type { CSSProperties, ReactNode } from "react";
import { broadcastBandColor } from "@/lib/labels/teamColors";
import { TeamLogo } from "@/components/ui/TeamLogo";
import styles from "./PronoBug.module.css";

// Bandeau du prono façon incrustation télé (05/10/2026, p3-8, retour alpha
// « moins rond, plus arena ») : remplace les pilules arrondies « BOS +3 ».
// Option C des maquettes (scorebug) avec la couleur de l'équipe
// pronostiquée sur la bande de l'écart, choisie par l'utilisateur. Partagé
// par PredictionSummary (cartes verrouillées : Mes pronos en cours et
// Résultats) et UpcomingRow (prono validé avant le coup d'envoi).
//
// Pas de "✓" (retiré 22/08/2026, signalé par l'utilisateur -- affiché à côté
// du score RÉEL une fois le match joué, il donnait l'impression trompeuse que
// le prono avait été GAGNANT). "+" (pas "−", même correctif) : "CHI +4" =
// Chicago gagne avec 4 points d'écart.

type PronoBugProps = {
  /** Vainqueur pronostiqué + écart ; null = bloc neutre `neutralLabel`. */
  pick: { abbreviation: string; margin: number } | null;
  /** Libellé du bloc neutre quand `pick` est null (« Pas de prono »...). */
  neutralLabel?: string;
  /** Contenu du bloc de droite (points) ; absent = pas de bloc. */
  points?: ReactNode;
};

export function PronoBug({ pick, neutralLabel, points }: PronoBugProps) {
  const bandColor = pick ? broadcastBandColor(pick.abbreviation) : null;
  return (
    // Libellé accessible d'un seul tenant : l'équipe et l'écart sont dans
    // des blocs séparés, lus sinon comme « BOS », « +3 ».
    <div
      className={styles.bug}
      role="group"
      aria-label={pick ? `Mon prono : ${pick.abbreviation} +${pick.margin}` : neutralLabel}
    >
      {pick ? (
        <>
          <span className={styles.team}>
            <TeamLogo abbreviation={pick.abbreviation} alt="" size={22} />
            {pick.abbreviation}
          </span>
          <span
            className={styles.margin}
            style={bandColor ? ({ "--team-color": bandColor } as CSSProperties) : undefined}
          >
            <span className={styles.slant}>+{pick.margin}</span>
          </span>
        </>
      ) : (
        // Pas de rouge (T7/R-COL) : un prono manquant/incomplet n'est pas un
        // résultat négatif, juste un rappel neutre.
        <span className={styles.neutral}>{neutralLabel}</span>
      )}
      {points !== undefined && <span className={styles.points}>{points}</span>}
    </div>
  );
}
