import type { ReactNode, SVGProps } from "react";

/**
 * Icônes du panneau Profil (TabBar). Même variante « nette » que
 * nav-icons.tsx (trait 1.8, coins droits, currentColor), 20 px par défaut.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const StatsIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
  </Base>
);

export const BadgeMedalIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5" />
  </Base>
);

export const HistoryIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </Base>
);

export const KeyIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 9-9M16 7l3 3" />
  </Base>
);

export const DownloadIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />
  </Base>
);

export const BellIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4l2-2ZM10 21h4" />
  </Base>
);

export const ThemeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16" />
    <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" />
  </Base>
);

export const SlidersIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Base>
);

export const HelpIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.5" />
  </Base>
);

export const LegalIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 3h8l4 4v14H6ZM14 3v4h4M9 12h6M9 16h6" />
  </Base>
);

export const LogoutIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 4H4v16h6M15 8l4 4-4 4M19 12H9" />
  </Base>
);

export const DangerIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3 2 20h20ZM12 10v4M12 17v.5" />
  </Base>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Base size={16} {...p}>
    <path d="m9 5 7 7-7 7" />
  </Base>
);
