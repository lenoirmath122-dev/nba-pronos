import type { SVGProps } from "react";

/**
 * Icônes des écrans Connexion/Inscription/Reset — même patron que
 * components/icons/home-icons.tsx (trait net, currentColor, coins droits,
 * viewBox 24x24). Toujours décorative : le texte à côté porte déjà le sens.
 */

type IconProps = SVGProps<SVGSVGElement> & {
  /** Taille en pixels (largeur = hauteur). */
  size?: number;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
} as const;

/** État "Vérifie ta boîte mail" du reset de mot de passe — enveloppe. */
export function MailIcon({ size = 32, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...STROKE} {...props}>
      <path d="M4 6h16v12H4z" />
      <path d="M4 6l8 7 8-7" />
    </svg>
  );
}
