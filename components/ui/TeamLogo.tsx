import { useState } from "react";
import Image from "next/image";
import styles from "./TeamLogo.module.css";

// Logo de franchise — partagé Bracket + Matchs (les deux seuls écrans avec un
// objet équipe structuré, voir GAPS_OUVERTS.md pour Accueil/Classement,
// laissés de côté). Chemin déduit de l'abréviation (public/logos/teams/
// {ABBRÉVIATION}.svg, convention posée §2.3 ETAT_ACTUEL) — aucun champ ajouté
// aux contrats de types figés des specs, aucune colonne base consommée.
// `unoptimized` : les SVG ne passent pas par l'optimiseur Next par défaut
// (nécessiterait `dangerouslyAllowSVG` + CSP dans next.config, non posé) —
// pattern documenté par Next.js pour ce cas exact. Repli texte si le fichier
// manque pour une équipe (fallback réel acté §2.3), via onError.
type TeamLogoProps = {
  abbreviation: string;
  alt: string;
  size?: number;
};

export function TeamLogo({ abbreviation, alt, size = 24 }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className={styles.fallback}>{abbreviation}</span>;
  }

  return (
    <Image
      src={`/logos/teams/${abbreviation}.svg`}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      className={styles.logo}
      onError={() => setFailed(true)}
    />
  );
}
