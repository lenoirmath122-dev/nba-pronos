import type { SVGProps } from "react";

/**
 * Icônes de l'écran Accueil (bloc « À traiter » et feed « Ça vient de
 * tomber ») — même patron que components/icons/nav-icons.tsx (trait net,
 * currentColor, coins droits, viewBox 24x24). Toujours décoratives : le
 * texte de la ligne porte déjà le sens.
 */

type IconProps = SVGProps<SVGSVGElement> & {
  /** Taille en pixels (largeur = hauteur). Défaut : 16 (chip 30px/26px). */
  size?: number;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
} as const;

function IconBase({ size = 16, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...STROKE} {...props}>
      {children}
    </svg>
  );
}

/** Bracket / phase finale — spine + branche, tournoi simplifié. */
export function BracketIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h5M4 12h5M4 18h5M9 6v12M9 12h5M14 10v4" />
    </IconBase>
  );
}

/** Paris — cible. */
export function BetsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

/** Revue admin — fanion. */
export function AdminFlagIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3v18" />
      <path d="M6 4h12l-3 4 3 4H6" />
    </IconBase>
  );
}

/** Résultat gagné — coche (vert/rouge strictement réservés au résultat, R-COL). */
export function WinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </IconBase>
  );
}

/** Résultat perdu — croix. */
export function LossIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  );
}

/** Neutralisé / en attente — tiret, jamais rouge (R-COL2). */
export function NeutralIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 12h12" />
    </IconBase>
  );
}
