import { ProgressBar } from "@/components/bracket/ProgressBar";
import type { BadgeDisplay } from "@/lib/queries/badges";
import type { BadgeTier } from "@/lib/badges/thresholds";
import styles from "./BadgeCard.module.css";

// Badges permanents (09/08/2026, phase 1) — cf. SPEC_BADGES_PERMANENTS_V0_1.md.
// Présentationnel pur, un BadgeDisplay en props (3 formes : tiered/binary/
// ladderStep, cf. lib/queries/badges.ts). Réutilise le ProgressBar existant
// (components/bracket/ProgressBar.tsx) plutôt que d'inventer un 2e composant
// de barre de progression.

const TIER_LABELS: Record<BadgeTier, string> = {
  BRONZE: "Bronze",
  ARGENT: "Argent",
  OR: "Or",
  PLATINE: "Platine",
  DIAMANT: "Diamant",
};

export function BadgeCard({ badge }: { badge: BadgeDisplay }) {
  if (badge.kind === "binary") {
    return (
      <div className={`${styles.card} ${badge.unlocked ? styles.unlocked : styles.locked}`}>
        <span className={styles.label}>{badge.label}</span>
        <span className={styles.description}>{badge.description}</span>
        <span className={styles.status}>{badge.unlocked ? "Débloqué" : "Verrouillé"}</span>
      </div>
    );
  }

  if (badge.kind === "ladderStep") {
    return (
      <div className={`${styles.card} ${badge.unlocked ? styles.unlocked : styles.locked}`}>
        <span className={styles.label}>{badge.label}</span>
        <span className={styles.description}>{badge.description}</span>
        <span className={styles.status}>{badge.unlocked ? "Débloqué" : `${badge.value}/${badge.threshold}`}</span>
      </div>
    );
  }

  const tierLabel = badge.tier ? TIER_LABELS[badge.tier] : null;
  const progressTotal = badge.nextThreshold ?? Math.max(badge.value, 1);

  return (
    <div
      className={`${styles.card} ${badge.tier ? styles.unlocked : styles.locked}`}
      data-tier={badge.tier ?? undefined}
    >
      <span className={styles.label}>{badge.label}</span>
      <span className={styles.description}>{badge.description}</span>
      {tierLabel && <span className={styles.tier}>{tierLabel}</span>}
      <ProgressBar
        filledCount={badge.value}
        totalCount={progressTotal}
        label={`${badge.label} : ${badge.value} sur ${progressTotal}`}
      />
    </div>
  );
}
