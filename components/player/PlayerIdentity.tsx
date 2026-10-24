import type { MouseEventHandler } from "react";
import { BadgeStrip } from "@/components/badges/BadgeStrip";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { getInitials } from "@/lib/player/initials";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./PlayerIdentity.module.css";

// Identité d'un joueur : avatar à initiales + pseudo + vitrine de badges. Un
// seul composant pour le classement (`row`), la barre « Ta place » (`bar`) et
// l'en-tête d'une page profil (`header`). Serveur : seul le pop-over d'un
// écusson est client. Avatar inchangé (orange sur orange pâle, jamais teinté
// équipe — contrainte DA du chantier Profil & badges).
type PlayerIdentityProps = {
  userId: string;
  pseudo: string;
  size: "row" | "bar" | "header";
  /** Vitrine déjà résolue (resolveShowcase), dans l'ordre d'affichage. */
  showcase?: BadgeDisplay[];
  /** Nombre d'écussons visibles (D2 : 1 en portrait, 3 en paysage). */
  maxBadges?: number;
  /** Pseudo cliquable vers /players/[id] ; faux sur la page du joueur lui-même. */
  linkToProfile?: boolean;
  /** Destination du lien « Voir les badges de … » du pop-over. */
  badgesHref?: string;
  onPseudoClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function PlayerIdentity({
  userId,
  pseudo,
  size,
  showcase = [],
  maxBadges,
  linkToProfile = true,
  badgesHref,
  onPseudoClick,
}: PlayerIdentityProps) {
  return (
    <span className={styles.identity} data-size={size}>
      <span className={styles.avatar} aria-hidden="true">
        {getInitials(pseudo)}
      </span>
      {linkToProfile ? (
        <PlayerLink userId={userId} pseudo={pseudo} className={styles.pseudo} onClick={onPseudoClick} />
      ) : (
        <span className={styles.pseudo}>{pseudo}</span>
      )}
      <BadgeStrip
        badges={showcase}
        ownerName={pseudo}
        badgesHref={badgesHref ?? `/players/${userId}`}
        max={maxBadges}
        showOverflow={size === "header"}
      />
    </span>
  );
}
