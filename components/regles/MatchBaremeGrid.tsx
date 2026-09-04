import styles from "./RuleContent.module.css";
import { MATCH_WINNER_POINTS, MARGIN_BONUS_DISPLAY_TIERS } from "@/lib/scoring/engine";

// Barème par pronostic de match — extrait de app/regles/page.tsx
// (28/08/2026) pour être réutilisé tel quel dans le pop-up d'aide de l'écran
// Jouer (RuleHelpButton sur app/(app)/play/page.tsx). Valeurs lues depuis
// lib/scoring/engine.ts (C3/ARCH-002) plutôt que recopiées à la main.
export function MatchBaremeGrid() {
  const maxMarginBonus = MARGIN_BONUS_DISPLAY_TIERS[0].points;
  return (
    <>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statCardLabel}>Bon vainqueur</span>
          <span className={styles.statCardValue}>{MATCH_WINNER_POINTS}</span>
        </div>
        {MARGIN_BONUS_DISPLAY_TIERS.map((tier) => (
          <div className={styles.statCard} key={tier.label}>
            <span className={styles.statCardLabel}>{tier.label}</span>
            <span className={styles.statCardValue}>+{tier.points}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        Le bonus d&apos;écart ne s&apos;applique que si le vainqueur est correct — un mauvais vainqueur
        rapporte 0 point, même avec un écart proche. Un prono rapporte donc entre {MATCH_WINNER_POINTS} et{" "}
        {MATCH_WINNER_POINTS + maxMarginBonus} points.
      </p>
      <p className={styles.note}>
        Une fois le match terminé, tes points (et ceux du bracket si la série est décidée) sont
        calculés automatiquement, généralement dans les 30 minutes qui suivent — pas besoin
        d&apos;attendre un admin.
      </p>
    </>
  );
}
