import styles from "./RuleContent.module.css";

// Barème par difficulté de pari personnalisé — extrait de
// app/regles/page.tsx (28/08/2026) pour être réutilisé dans le pop-up d'aide
// du formulaire de pari (RuleHelpButton sur InlineBetForm.tsx). Valeurs
// alignées sur lib/scoring/engine.ts::BET_DIFFICULTY_POINTS.
export function BetDifficulteGrid() {
  return (
    <>
      <div className={styles.statGridWide}>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Niveau 1</span>
          <span className={styles.statCardValue}>5</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Niveau 2</span>
          <span className={styles.statCardValue}>10</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Niveau 3</span>
          <span className={styles.statCardValue}>15</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Niveau 4</span>
          <span className={styles.statCardValue}>20</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Niveau 5</span>
          <span className={styles.statCardValue}>25</span>
        </div>
      </div>
      <p className={styles.note}>
        Un pari perdu ou annulé ne rapporte ni ne coûte rien (0 point, jamais de pénalité).
      </p>
    </>
  );
}
