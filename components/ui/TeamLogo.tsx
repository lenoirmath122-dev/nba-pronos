"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./TeamLogo.module.css";

// Directive ajoutée le 24/07/2026 (lot "Mes pronos", §1.1) : ce composant
// utilise useState mais n'avait jamais sa PROPRE frontière client — il ne
// fonctionnait que parce que ses deux points d'appel (NodeCard, MatchRow)
// sont toujours atteints via un ancêtre "use client" (transitivement bundlé,
// ETAT_ACTUEL §2.9). Sur l'écran "Mes pronos", MatchRowStatic (serveur, sans
// ancêtre client) l'utilise directement — d'où la directive explicite, qui ne
// change AUCUN rendu pour Bracket/Matchs (déjà dans ce cas en pratique).

// Logo de franchise — partagé Bracket + Matchs (les deux seuls écrans avec un
// objet équipe structuré, voir GAPS_OUVERTS.md pour Accueil/Classement,
// laissés de côté). Chemin déduit de l'abréviation (public/logos/teams/
// {ABBRÉVIATION}.svg, convention posée §2.3 ETAT_ACTUEL) — aucun champ ajouté
// aux contrats de types figés des specs, aucune colonne base consommée.
// `unoptimized` : les SVG ne passent pas par l'optimiseur Next par défaut
// (nécessiterait `dangerouslyAllowSVG` + CSP dans next.config, non posé) —
// pattern documenté par Next.js pour ce cas exact. Repli texte si le fichier
// manque pour une équipe (fallback réel acté §2.3), via onError.
//
// Le logo (ou son repli) est inscrit dans une pastille neutre constante
// (§10.1) : le `size` est le diamètre de la pastille, le contenu remplit
// l'intérieur moins le padding.
type TeamLogoProps = {
  abbreviation: string;
  alt: string;
  size?: number;
};

export function TeamLogo({ abbreviation, alt, size = 24 }: TeamLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={styles.pastille} style={{ width: size, height: size }}>
      {failed ? (
        <span className={styles.fallback}>{abbreviation}</span>
      ) : (
        <Image
          src={`/logos/teams/${abbreviation}.svg`}
          alt={alt}
          width={size}
          height={size}
          unoptimized
          className={styles.logo}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
