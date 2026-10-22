import type { SVGProps } from "react";

/**
 * Icônes ajoutées le 14/09/2026 pour la carte pronostic compacte (déclencheur
 * de participation) — même patron que components/icons/nav-icons.tsx (trait
 * net, currentColor, viewBox 24x24, décoratives par défaut).
 */

type IconProps = SVGProps<SVGSVGElement> & {
  /** Taille en pixels (largeur = hauteur). Défaut : 18. */
  size?: number;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
} as const;

function IconBase({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  const decorative = props["aria-label"] == null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={decorative || undefined} {...STROKE} {...props}>
      {children}
    </svg>
  );
}

/** Participation / social — deux silhouettes (vs ProfileIcon, une seule). */
export function PeopleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="8.6" cy="8.2" r="3" />
      <path d="M3.2 19c0-3 2.4-4.8 5.4-4.8s5.4 1.8 5.4 4.8" />
      <path d="M14.8 8.6a2.6 2.6 0 1 0 0-5.2" />
      <path d="M14.1 14.5c2.6.3 4.3 2 4.3 4.5" />
    </IconBase>
  );
}

/** Œil — « voir » (paris des autres, zone Mon pari). */
export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </IconBase>
  );
}
