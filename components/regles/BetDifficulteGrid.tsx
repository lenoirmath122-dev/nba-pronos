import styles from "./RuleContent.module.css";
import { betDifficultyPoints } from "@/lib/scoring/engine";
import type { CompetitionType } from "@/lib/competitions/types";

const LEVELS = [1, 2, 3, 4, 5] as const;

// Barème par difficulté de pari personnalisé — extrait de
// app/regles/page.tsx (28/08/2026) pour être réutilisé dans le pop-up d'aide
// du formulaire de pari (RuleHelpButton sur InlineBetForm.tsx). Valeurs
// lues depuis lib/scoring/engine.ts::betDifficultyPoints (C3/ARCH-002)
// plutôt que recopiées à la main.
export function BetDifficulteGrid({ competitionType = "PLAYOFFS" }: { competitionType?: CompetitionType }) {
  const points = betDifficultyPoints(competitionType);
  return (
    <>
      <div className={styles.statGridWide}>
        {LEVELS.map((level) => (
          <div className={styles.statCard} key={level}>
            <span className={styles.statCardLabel}>Niveau {level}</span>
            <span className={styles.statCardValue}>{points[level]}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        Un pari perdu ou annulé ne rapporte ni ne coûte rien (0 point, jamais de pénalité).
      </p>
      <p className={styles.note}>
        Un pari calculable est résolu automatiquement le lendemain du match, généralement en fin de
        matinée — le temps que les vraies statistiques de la veille soient disponibles.
      </p>
    </>
  );
}
