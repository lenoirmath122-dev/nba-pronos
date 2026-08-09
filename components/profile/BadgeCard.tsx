"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/bracket/ProgressBar";
import type { BadgeDisplay } from "@/lib/queries/badges";
import type { BadgeTier } from "@/lib/badges/thresholds";
import styles from "./BadgeCard.module.css";

// Badges permanents (09/08/2026) — cf. SPEC_BADGES_PERMANENTS_V0_1.md.
// "use client" nécessaire (10/08/2026) : interaction "carte retournée" au
// clic/tap pour afficher la description au dos — la seule raison de sortir
// du composant serveur par défaut de ce module. Réutilise le ProgressBar
// existant (components/bracket/ProgressBar.tsx) plutôt que d'inventer un 2e
// composant de barre de progression.

const TIER_LABELS: Record<BadgeTier, string> = {
  BRONZE: "Bronze",
  ARGENT: "Argent",
  OR: "Or",
  PLATINE: "Platine",
  DIAMANT: "Diamant",
};

function isUnlocked(badge: BadgeDisplay): boolean {
  return badge.kind === "tiered" ? badge.tier !== null : badge.unlocked;
}

function FrontFace({ badge }: { badge: BadgeDisplay }) {
  if (badge.kind === "binary") {
    return <span className={styles.status}>{badge.unlocked ? "Débloqué" : "Verrouillé"}</span>;
  }
  if (badge.kind === "ladderStep") {
    return <span className={styles.status}>{badge.unlocked ? "Débloqué" : `${badge.value}/${badge.threshold}`}</span>;
  }
  const progressTotal = badge.nextThreshold ?? Math.max(badge.value, 1);
  return (
    <>
      {badge.tier && <span className={styles.tier}>{TIER_LABELS[badge.tier]}</span>}
      <ProgressBar
        filledCount={badge.value}
        totalCount={progressTotal}
        label={`${badge.label} : ${badge.value} sur ${progressTotal}`}
      />
    </>
  );
}

export function BadgeCard({ badge }: { badge: BadgeDisplay }) {
  const [flipped, setFlipped] = useState(false);
  const unlocked = isUnlocked(badge);
  const tierAttr = badge.kind === "tiered" ? (badge.tier ?? undefined) : undefined;
  const faceClass = `${styles.face} ${styles.card} ${unlocked ? styles.unlocked : styles.locked}`;

  return (
    <button
      type="button"
      className={styles.flipContainer}
      onClick={() => setFlipped((f) => !f)}
      aria-pressed={flipped}
      aria-label={`${badge.label} — ${flipped ? "retour à la carte" : "voir la description"}`}
    >
      <div className={`${styles.flipInner} ${flipped ? styles.flipped : ""}`}>
        <div className={`${faceClass} ${styles.front}`} data-tier={tierAttr} aria-hidden={flipped}>
          <span className={styles.label}>{badge.label}</span>
          <FrontFace badge={badge} />
        </div>
        <div className={`${faceClass} ${styles.back}`} data-tier={tierAttr} aria-hidden={!flipped}>
          <span className={styles.label}>{badge.label}</span>
          <span className={styles.description}>{badge.description}</span>
        </div>
      </div>
    </button>
  );
}
