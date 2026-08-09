import type { ProfileBadgesData } from "@/lib/queries/badges";
import { BadgeCard } from "./BadgeCard";
import styles from "./BadgesSection.module.css";

// Badges permanents (09/08/2026, phase 1) — cf. SPEC_BADGES_PERMANENTS_V0_1.md.
// Composant serveur (pas de "use client"), même famille que
// RankEvolutionChart.tsx — reçoit les données déjà calculées en props,
// aucun fetch côté client.

export function BadgesSection({ data }: { data: ProfileBadgesData }) {
  if (data.categories.length === 0) {
    return <p className={styles.empty}>Bientôt disponible.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.hint}>Astuce : clique sur une carte pour voir sa description.</p>
      {data.categories.map((category) => (
        <div key={category.id} className={styles.category}>
          <h3 className={styles.categoryTitle}>{category.title}</h3>
          <div className={styles.grid}>
            {category.badges.map((badge) => (
              <BadgeCard key={badge.id} badge={badge} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
