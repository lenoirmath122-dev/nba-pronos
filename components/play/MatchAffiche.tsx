import { TeamLogo } from "@/components/ui/TeamLogo";
import type { TeamRef } from "@/lib/queries/matches";
import styles from "./MatchAffiche.module.css";

// Affiche du match (logo · « UTA – NOP » · logo), en haut à droite des cartes
// Jouer quand la rangée des boutons d'équipe est remplacée par la bande
// « Mon prono ».
export function MatchAffiche({ home, away }: { home: TeamRef; away: TeamRef }) {
  return (
    <span className={styles.affiche}>
      <TeamLogo abbreviation={home.abbreviation} alt={home.name} size={22} />
      <span>
        {home.abbreviation}
        <span className={styles.dash}> – </span>
        {away.abbreviation}
      </span>
      <TeamLogo abbreviation={away.abbreviation} alt={away.name} size={22} />
    </span>
  );
}
