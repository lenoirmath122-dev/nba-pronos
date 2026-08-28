import styles from "./RuleContent.module.css";

// Barème par pronostic de match — extrait de app/regles/page.tsx
// (28/08/2026) pour être réutilisé tel quel dans le pop-up d'aide de l'écran
// Jouer (RuleHelpButton sur app/(app)/play/page.tsx) : SOURCE UNIQUE, valeurs
// alignées sur lib/scoring/engine.ts (marginBonusFor/scoreMatchPrediction).
export function MatchBaremeGrid() {
  return (
    <>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Bon vainqueur</span>
          <span className={styles.statCardValue}>10</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Écart exact</span>
          <span className={styles.statCardValue}>+5</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Écart à 1-2 pts</span>
          <span className={styles.statCardValue}>+3</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Écart à 3-5 pts</span>
          <span className={styles.statCardValue}>+2</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Écart à 6-9 pts</span>
          <span className={styles.statCardValue}>+1</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Écart ≥ 10 pts</span>
          <span className={styles.statCardValue}>+0</span>
        </div>
      </div>
      <p className={styles.note}>
        Le bonus d&apos;écart ne s&apos;applique que si le vainqueur est correct — un mauvais vainqueur
        rapporte 0 point, même avec un écart proche. Un prono rapporte donc entre 10 et 15 points.
      </p>
    </>
  );
}
