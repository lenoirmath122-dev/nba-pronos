import { BADGE_ICONS } from "@/lib/badges/icons";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./PinnedBadges.module.css";

// Badges épinglés dans le bandeau du profil (27/08/2026, BACKLOG_V1.md) --
// affichage compact icône-seule anticipé par le commentaire de
// BadgeCard.module.css (10/08/2026, "cohérent avec un futur affichage
// compact dans le bandeau de profil"). Composant serveur, données déjà
// résolues et ordonnées par lib/queries/badges.ts::getProfileBadges
// (pinnedBadges).

export function PinnedBadges({ badges }: { badges: BadgeDisplay[] }) {
  if (badges.length === 0) return null;

  return (
    <span className={styles.row}>
      {badges.map((badge) => {
        const Icon = BADGE_ICONS[badge.id];
        const tier = badge.kind === "tiered" ? (badge.tier ?? undefined) : undefined;
        return (
          <span key={badge.id} className={styles.iconWrap} data-tier={tier} title={badge.label} role="img" aria-label={badge.label}>
            <Icon className={styles.icon} aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}
