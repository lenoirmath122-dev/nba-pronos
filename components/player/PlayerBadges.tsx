import { BadgeStrip } from "@/components/badges/BadgeStrip";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./PlayerBadges.module.css";

// Vitrine d'une ligne de classement, posée à gauche des points (et non plus
// juste après le pseudo). Même règle D2 qu'avant : 3 écussons en paysage /
// desktop, 1 seul (le badge signature) en portrait mobile. Serveur.
export function PlayerBadges({
  userId,
  pseudo,
  showcase,
  max = 3,
}: {
  userId: string;
  pseudo: string;
  showcase?: BadgeDisplay[];
  max?: number;
}) {
  if (!showcase || showcase.length === 0) return null;
  return (
    <span className={styles.badges}>
      <BadgeStrip badges={showcase} ownerName={pseudo} badgesHref={`/players/${userId}`} max={max} />
    </span>
  );
}
