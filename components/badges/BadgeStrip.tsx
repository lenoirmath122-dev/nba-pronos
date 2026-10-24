import type { BadgeDisplay } from "@/lib/queries/badges";
import { BadgePopover } from "./BadgePopover";
import styles from "./BadgeStrip.module.css";

// Rangée d'écussons « sm » dans l'ordre de la vitrine (resolveShowcase). Chaque
// écusson ouvre son pop-over. `max` limite l'affichage ; le reste devient « +k »
// quand `showOverflow` est demandé (le classement montre 1 badge en portrait,
// 3 en paysage — D2).
type BadgeStripProps = {
  badges: BadgeDisplay[];
  ownerName: string;
  badgesHref?: string;
  max?: number;
  showOverflow?: boolean;
};

export function BadgeStrip({ badges, ownerName, badgesHref, max, showOverflow = false }: BadgeStripProps) {
  if (badges.length === 0) return null;
  const visible = max === undefined ? badges : badges.slice(0, max);
  const hidden = badges.length - visible.length;

  return (
    <span className={styles.row}>
      <BadgePopover badges={visible} ownerName={ownerName} badgesHref={badgesHref} />
      {showOverflow && hidden > 0 && (
        <span className={styles.more} aria-label={`${hidden} autres badges`}>
          +{hidden}
        </span>
      )}
    </span>
  );
}
