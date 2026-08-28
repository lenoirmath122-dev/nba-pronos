import type { SVGProps } from "react";

/**
 * Icône du bouton de notification par canal (ChatNotificationToggle.tsx) --
 * même patron que components/icons/nav-icons.tsx (trait net, currentColor,
 * coins droits, viewBox 24x24). Une seule forme de cloche, barrée d'une
 * diagonale quand `enabled` est faux plutôt que 2 icônes séparées -- le seul
 * état qui varie visuellement est la présence de la barre.
 */

type NotificationBellIconProps = SVGProps<SVGSVGElement> & {
  enabled: boolean;
  size?: number;
};

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
} as const;

export function NotificationBellIcon({ enabled, size = 20, ...props }: NotificationBellIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...STROKE} {...props}>
      <path d="M18 9.8A6 6 0 0 0 6 9.8c0 6.3-2.4 8-2.4 8h16.8s-2.4-1.7-2.4-8Z" />
      <path d="M10.4 20.8a1.7 1.7 0 0 0 3.2 0" />
      {!enabled && <path d="M4 4.4 20 19.6" />}
    </svg>
  );
}
