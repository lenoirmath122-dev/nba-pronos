import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
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
  /** Faux : pas d'écussons à côté du pseudo (le classement les met à gauche des points). */
  showBadges?: boolean;
  /** Photo du joueur (sinon : initiales). */
  avatarUrl?: string | null;
  /** Équipe favorite : repli de la photo, avant les initiales. */
  teamAbbreviation?: string | null;
  /** Ligne secondaire sous le pseudo (classement hebdo : bons vainqueurs, écarts exacts). */
  detail?: ReactNode;
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
  showBadges = true,
  avatarUrl,
  teamAbbreviation,
  detail,
}: PlayerIdentityProps) {
  const avatar = (
      <span className={!avatarUrl && teamAbbreviation ? `${styles.avatar} ${styles.avatarOnTeam}` : styles.avatar} aria-hidden="true">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className={styles.avatarImg} />
        ) : teamAbbreviation ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/logos/teams/${teamAbbreviation}.svg`} alt="" className={styles.avatarTeam} />
        ) : (
          getInitials(pseudo)
        )}
      </span>
  );
  return (
    <span className={styles.identity} data-size={size}>
      {linkToProfile ? (
        // Le pseudo reste le lien accessible : celui de la bulle est redondant pour le clavier.
        <Link
          href={`/players/${userId}`}
          prefetch={false}
          className={styles.avatarLink}
          tabIndex={-1}
          aria-hidden="true"
          onClick={onPseudoClick}
        >
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <span className={styles.text}>
      {linkToProfile ? (
        <PlayerLink userId={userId} pseudo={pseudo} className={styles.pseudo} onClick={onPseudoClick} />
      ) : (
        <span className={styles.pseudo}>{pseudo}</span>
      )}
      {detail && <span className={styles.detail}>{detail}</span>}
      </span>
      {showBadges && (
      <BadgeStrip
        badges={showcase}
        ownerName={pseudo}
        badgesHref={badgesHref ?? `/players/${userId}`}
        max={maxBadges}
        showOverflow={size === "header"}
      />
      )}
    </span>
  );
}
