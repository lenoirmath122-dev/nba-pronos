import { BadgeEmblem } from "@/components/badges/BadgeEmblem";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./PinnedBadges.module.css";

// Badges épinglés dans le bandeau du profil (27/08/2026, BACKLOG_V1.md) --
// affichage compact icône-seule anticipé par le commentaire de
// BadgeCard.module.css (10/08/2026, "cohérent avec un futur affichage
// compact dans le bandeau de profil"). Composant serveur, données déjà
// résolues et ordonnées par lib/queries/badges.ts::getProfileBadges
// (pinnedBadges). Écusson en petit depuis le 05/10/2026 (p3-9).

export function PinnedBadges({ badges }: { badges: BadgeDisplay[] }) {
  if (badges.length === 0) return null;

  return (
    <span className={styles.row}>
      {badges.map((badge) => (
        <span key={badge.id} className={styles.iconWrap} title={badge.label} role="img" aria-label={badge.label}>
          <BadgeEmblem badge={badge} size="sm" />
        </span>
      ))}
    </span>
  );
}
