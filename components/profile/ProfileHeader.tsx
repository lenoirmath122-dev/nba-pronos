import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { PlayerIdentity } from "@/components/player/PlayerIdentity";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { TEAM_COLORS } from "@/lib/labels/teamColors";
import type { BadgeDisplay } from "@/lib/queries/badges";
import type { TeamRef } from "@/lib/queries/matches";
import styles from "./ProfileHeader.module.css";

// En-tête commun des pages profil (Lot 3 du chantier Profil & badges) : « Mon
// profil » et, au Lot 3b, /players/[id]. Bandeau photo recoloré aux couleurs
// de l'équipe favorite (D4, rendu du 04/08 repris — seul endroit où la couleur
// d'équipe est permise), puis avatar + pseudo + badge signature, puces, et en
// mode soi le bouton « Modifier le profil ». Sans équipe : simple carte, rien
// ne change. Composant serveur.
type ProfileHeaderProps = {
  userId: string;
  pseudo: string;
  favoriteTeam: TeamRef | null;
  isAdmin?: boolean;
  isInactive?: boolean;
  /** Vitrine résolue ; seul le premier écusson (badge signature) est affiché. */
  showcase: BadgeDisplay[];
  /** Puces sous le pseudo (rang, badges, meilleur rang...). */
  chips: { label: ReactNode; accent?: boolean }[];
  bio?: string;
  /** Mode soi : lien « Modifier le profil ». */
  editHref?: string;
  /** Destination du lien « Voir ses badges » du pop-over. */
  badgesHref: string;
};

export function ProfileHeader({
  userId,
  pseudo,
  favoriteTeam,
  isAdmin,
  isInactive,
  showcase,
  chips,
  bio,
  editHref,
  badgesHref,
}: ProfileHeaderProps) {
  const colors = favoriteTeam ? TEAM_COLORS[favoriteTeam.abbreviation] : undefined;
  const bannerStyle = colors
    ? ({ "--team-primary": colors.primary, "--team-secondary": colors.secondary } as CSSProperties)
    : undefined;
  const subtitle = [favoriteTeam?.name, isAdmin ? "Admin" : null, isInactive ? "Compte désactivé" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className={`${styles.header} ${colors ? styles.withTeam : "glass-card"}`} style={bannerStyle}>
      {colors && favoriteTeam && (
        <div className={styles.banner} aria-hidden="true">
          <span className={styles.crest}>
            <TeamLogo abbreviation={favoriteTeam.abbreviation} alt="" size={44} />
          </span>
        </div>
      )}
      <div className={styles.body}>
        <PlayerIdentity
          userId={userId}
          pseudo={pseudo}
          size="header"
          showcase={showcase}
          maxBadges={1}
          linkToProfile={false}
          badgesHref={badgesHref}
        />
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {bio && <p className={styles.bio}>{bio}</p>}
        <div className={styles.chips}>
          {chips.map((chip, i) => (
            <span key={i} className={chip.accent ? styles.chipAccent : styles.chip}>
              {chip.label}
            </span>
          ))}
          {editHref && (
            <Link href={editHref} className={styles.edit}>
              Modifier le profil
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
