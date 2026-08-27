import type { ReactNode, SVGProps } from "react";

/**
 * Icônes de la barre de navigation basse (Accueil · Jouer · Classement · Profil).
 *
 * Variante « nette » (B) retenue : trait 1.8, extrémités et jonctions franches,
 * coins droits — cohérente avec les rayons « niveau C » du design system (T7).
 *
 * Toutes en `currentColor` : la couleur est pilotée par le parent (accent quand
 * l'onglet est actif, muted sinon), donc les icônes suivent le thème sans aucune
 * logique interne. Décoratives par défaut (le libellé de l'onglet porte le sens)
 * → `aria-hidden`, sauf si un `aria-label` explicite est fourni.
 *
 * N'amende aucune décision figée : simple ajout d'assets d'UI.
 */

type IconProps = SVGProps<SVGSVGElement> & {
  /** Taille en pixels (largeur = hauteur). Défaut : 24. */
  size?: number;
};

// Attributs de trait communs à la variante « nette » (B).
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
} as const;

function IconBase({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  // Décorative tant qu'aucun libellé accessible n'est explicitement demandé.
  const decorative = props["aria-label"] == null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={decorative || undefined}
      {...STROKE}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Accueil — maison. */
export function HomeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.6 10.8 12 4.2l8.4 6.6" />
      <path d="M5.8 9.4V19.6H18.2V9.4" />
      <path d="M10 19.6V14.2H14V19.6" />
    </IconBase>
  );
}

/** Jouer — ballon de basket (thème NBA). */
export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 3.8V20.2M3.8 12H20.2" />
      <path d="M6.05 6.05C8.5 8.4 9.7 10.1 9.7 12s-1.2 3.6-3.65 5.95" />
      <path d="M17.95 6.05C15.5 8.4 14.3 10.1 14.3 12s1.2 3.6 3.65 5.95" />
    </IconBase>
  );
}

/**
 * Classement — podium.
 * Volontairement PAS un trophée : l'or/champion est une réservation figée (T7),
 * un trophée dans la nav créerait une collision sémantique.
 */
export function RankingIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.6" y="12.6" width="5.8" height="7.4" />
      <rect x="9.4" y="8" width="5.2" height="12" />
      <rect x="14.6" y="14.6" width="5.8" height="5.4" />
    </IconBase>
  );
}

/** Profil — silhouette. */
export function ProfileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8.4" r="3.7" />
      <path d="M5.5 19.6c0-3.7 2.9-5.8 6.5-5.8s6.5 2.1 6.5 5.8" />
    </IconBase>
  );
}

/** Chat — bulle rectangulaire (coins droits, même esprit que RankingIcon)
 *  avec une queue et 2 lignes de texte, ajoutée le 27/08/2026. */
export function ChatIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.6" y="4.6" width="16.8" height="12" />
      <path d="M8 16.6V20.2L11.8 16.6" />
      <path d="M7 9H17M7 12.4H13.5" />
    </IconBase>
  );
}
