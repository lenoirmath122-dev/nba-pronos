import Link from "next/link";
import type { MouseEventHandler } from "react";

// Lien partagé vers la page "profil joueur" (`/players/[userId]`), posé le
// 30/07/2026 sur CHAQUE pseudo déjà affiché en lecture seule à travers le
// site (Classement, Bracket, Mes pronos, Matchs, écrans admin) — demandé
// explicitement par l'utilisateur ("actif sur TOUTES les pages"). Composant
// minuscule plutôt que dupliquer le <Link> + son style partout : un seul
// endroit à faire évoluer si le style ou la route change un jour.
//
// `onClick` optionnel : plusieurs points d'appel posent ce lien À
// L'INTÉRIEUR d'une ligne elle-même cliquable (Classement) — sans
// stopPropagation ici, cliquer le pseudo déclencherait AUSSI le
// déplier/replier de la ligne parente.
type PlayerLinkProps = {
  userId: string;
  pseudo: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function PlayerLink({ userId, pseudo, className, onClick }: PlayerLinkProps) {
  return (
    <Link href={`/players/${userId}`} className={className} onClick={onClick}>
      {pseudo}
    </Link>
  );
}
