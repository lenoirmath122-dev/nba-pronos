import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeStrip } from "@/components/badges/BadgeStrip";
import { PlayerIdentity } from "@/components/player/PlayerIdentity";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { BadgeDisplay } from "@/lib/queries/badges";
import type { TeamRef } from "@/lib/queries/matches";
import styles from "./ProfileHeader.module.css";

// En-tête commun des pages profil (Lot 3 du chantier Profil & badges) : « Mon
// profil » et /players/[id]. Carte simple (plus de bandeau photo ni de dégradé
// aux couleurs de l'équipe) : avatar + pseudo, puces, vitrine de badges, et en
// mode soi le bouton « Modifier le profil ». L'équipe favorite se résume à son
// logo en haut à droite. Composant serveur.
type ProfileHeaderProps = {
  userId: string;
  pseudo: string;
  favoriteTeam: TeamRef | null;
  isAdmin?: boolean;
  isInactive?: boolean;
  /** Vitrine résolue (jusqu'à 3 écussons), affichée sous les puces. */
  showcase: BadgeDisplay[];
  /** Remplace la vitrine en lecture seule (mode soi : emplacements modifiables). */
  showcaseSlot?: ReactNode;
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
  showcaseSlot,
  chips,
  bio,
  editHref,
  badgesHref,
}: ProfileHeaderProps) {
  const subtitle = [favoriteTeam?.name, isAdmin ? "Admin" : null, isInactive ? "Compte désactivé" : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <header className={`${styles.header} glass-card`}>
      {favoriteTeam && (
        <span className={styles.crest} aria-hidden="true">
          <TeamLogo abbreviation={favoriteTeam.abbreviation} alt="" size={44} />
        </span>
      )}
      <div className={styles.body}>
        <PlayerIdentity
          userId={userId}
          pseudo={pseudo}
          size="header"
          linkToProfile={false}
          showBadges={false}
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
        {showcaseSlot ??
          (showcase.length > 0 && (
            <div className={styles.showcase}>
              <BadgeStrip badges={showcase} ownerName={pseudo} badgesHref={badgesHref} max={3} size="md" />
            </div>
          ))}
      </div>
    </header>
  );
}
