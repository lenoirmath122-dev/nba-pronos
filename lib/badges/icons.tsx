import type { ReactNode, SVGProps } from "react";
import type { BadgeId } from "./thresholds";

// Visuels des badges (Lot 7 du chantier Profil & badges, p6-20) : dessinés sur
// mesure, un par badge, en remplacement des icônes lucide-react (10/08/2026).
// Même contrat qu'avant : un composant qui prend `className` et se colore par
// `currentColor` (la couleur de palier vient de BadgeEmblem.module.css). Grille
// 32 × 32, trait de 2, extrémités arrondies ; chaque dessin ajoute une
// « masse » à 28 % d'opacité (ACCENT) pour donner du volume sans aucune
// couleur nouvelle (contrainte DA). Les badges à compteur ou à afficheur
// gardent leur centre propre une fois débloqués (BadgeEmblem.tsx) ; ces
// dessins servent en petit et tant qu'ils sont verrouillés.

export type BadgeIcon = (props: SVGProps<SVGSVGElement>) => ReactNode;

const ACCENT = { fill: "currentColor", fillOpacity: 0.28, stroke: "none" } as const;

function draw(children: ReactNode): BadgeIcon {
  return function Icon(props) {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

/** Dé : carré arrondi + points donnés (coordonnées sur la grille 32). */
function die(pips: [number, number][]): BadgeIcon {
  return draw(
    <>
      <rect x="5" y="5" width="22" height="22" rx="5" />
      <rect x="5" y="5" width="22" height="22" rx="5" {...ACCENT} />
      {pips.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="currentColor" stroke="none" />
      ))}
    </>
  );
}

const Check = draw(
  <>
    <circle cx="16" cy="16" r="12" {...ACCENT} />
    <circle cx="16" cy="16" r="12" />
    <path d="M10 16.5l4.5 4.5L22.5 11" />
  </>
);

const Buzzer = draw(
  <>
    <circle cx="16" cy="18" r="10" {...ACCENT} />
    <circle cx="16" cy="18" r="10" />
    <path d="M16 12v6l4 2.5M6 8l4-3.5M26 8l-4-3.5" />
  </>
);

const Lynx = draw(
  <>
    <path d="M3 16c4-6 8-8 13-8s9 2 13 8c-4 6-8 8-13 8S7 22 3 16z" {...ACCENT} />
    <path d="M3 16c4-6 8-8 13-8s9 2 13 8c-4 6-8 8-13 8S7 22 3 16z" />
    <circle cx="16" cy="16" r="4.5" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
  </>
);

const Metronome = draw(
  <>
    <path d="M10.5 27L14 5h4l3.5 22z" {...ACCENT} />
    <path d="M10.5 27L14 5h4l3.5 22zM16 21l5-11" />
    <rect x="18.2" y="10.5" width="4" height="3.5" rx="1" fill="currentColor" stroke="none" />
  </>
);

const Scroll = draw(
  <>
    <rect x="7" y="4" width="18" height="24" rx="3" {...ACCENT} />
    <rect x="7" y="4" width="18" height="24" rx="3" />
    <path d="M12 11h8M12 16h8M12 21h5" />
  </>
);

const Chain = draw(
  <>
    <path d="M6 24l7-9 5 4 8-11" />
    <circle cx="6" cy="24" r="3" {...ACCENT} />
    <circle cx="13" cy="15" r="3" {...ACCENT} />
    <circle cx="18" cy="19" r="3" {...ACCENT} />
    <circle cx="26" cy="8" r="3.5" fill="currentColor" stroke="none" />
  </>
);

const Percent = draw(
  <>
    <path d="M24 7L8 25" />
    <circle cx="10" cy="10" r="4" {...ACCENT} />
    <circle cx="10" cy="10" r="4" />
    <circle cx="22" cy="22" r="4" {...ACCENT} />
    <circle cx="22" cy="22" r="4" />
  </>
);

const Cards = draw(
  <>
    <rect x="4" y="9" width="17" height="19" rx="3" {...ACCENT} />
    <rect x="4" y="9" width="17" height="19" rx="3" />
    <path d="M11 5h13a3 3 0 013 3v14" />
    <path d="M9 18l3 3 5-6" />
  </>
);

const Network = draw(
  <>
    <path d="M16 8L7 20M16 8l9 12M7 20h18M16 8v9M7 20l9-3M25 20l-9-3" />
    <circle cx="16" cy="8" r="3.5" fill="currentColor" stroke="none" />
    <circle cx="7" cy="20" r="3" {...ACCENT} />
    <circle cx="7" cy="20" r="3" />
    <circle cx="25" cy="20" r="3" {...ACCENT} />
    <circle cx="25" cy="20" r="3" />
    <circle cx="16" cy="17" r="2.5" fill="currentColor" stroke="none" />
  </>
);

const Sparkles = draw(
  <>
    <path d="M14 5l2.6 7.4L24 15l-7.4 2.6L14 25l-2.6-7.4L4 15l7.4-2.6z" {...ACCENT} />
    <path d="M14 5l2.6 7.4L24 15l-7.4 2.6L14 25l-2.6-7.4L4 15l7.4-2.6zM25 4v5M22.5 6.5h5M26 21v4M24 23h4" />
  </>
);

const Binoculars = draw(
  <>
    <circle cx="9.5" cy="21" r="5.5" {...ACCENT} />
    <circle cx="9.5" cy="21" r="5.5" />
    <circle cx="22.5" cy="21" r="5.5" {...ACCENT} />
    <circle cx="22.5" cy="21" r="5.5" />
    <path d="M15 20h2M6 17L9 6h3l1.5 8M26 17L23 6h-3l-1.5 8" />
  </>
);

const Calculator = draw(
  <>
    <rect x="6" y="3" width="20" height="26" rx="4" {...ACCENT} />
    <rect x="6" y="3" width="20" height="26" rx="4" />
    <path d="M11 9h10" strokeWidth={3} />
    {[
      [11, 16],
      [16, 16],
      [21, 16],
      [11, 22],
      [16, 22],
      [21, 22],
    ].map(([x, y]) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" stroke="none" />
    ))}
  </>
);

// Schéma de jeu : O, X et le mouvement entre les deux.
const Playbook = draw(
  <>
    <circle cx="8" cy="24" r="4" {...ACCENT} />
    <circle cx="8" cy="24" r="4" />
    <path d="M21 5l7 7M28 5l-7 7" />
    <path d="M10 19c1-8 6-11 8-11" strokeDasharray="3 3" />
    <path d="M24 26c-1-5-4-8-9-9" />
    <path d="M17.5 21l-3-4 4.5-1" />
  </>
);

const Pie = draw(
  <>
    <circle cx="16" cy="16" r="12" />
    <path d="M16 16V4a12 12 0 0110.4 6z" {...ACCENT} />
    <path d="M16 16V4M16 16l10.4-6" />
    <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
  </>
);

const Swords = draw(
  <>
    <path d="M6 6l15 15M26 6L11 21" />
    <path d="M5 11l6 6M27 11l-6 6M8 24l-3 3M24 24l3 3M9 27l-3-3M23 27l3-3" />
    <path d="M6 6h5l-1 4zM26 6h-5l1 4z" {...ACCENT} />
  </>
);

const Stopwatch = draw(
  <>
    <circle cx="16" cy="18" r="10" {...ACCENT} />
    <circle cx="16" cy="18" r="10" />
    <path d="M13 4h6M16 4v4M16 18l5-5M25 8l2 2" />
  </>
);

const Crowd = draw(
  <>
    <circle cx="12" cy="11" r="4.5" {...ACCENT} />
    <circle cx="12" cy="11" r="4.5" />
    <path d="M3 27c0-5 4-8 9-8s9 3 9 8" />
    <path d="M21 6.5a4.5 4.5 0 010 9M25 20c2 1.5 3 3.8 3 7" />
  </>
);

const Paw = draw(
  <>
    <path d="M16 15c-4 0-8 4-8 8 0 3 2 4 4 4 2 0 2.5-1 4-1s2 1 4 1c2 0 4-1 4-4 0-4-4-8-8-8z" {...ACCENT} />
    <path d="M16 15c-4 0-8 4-8 8 0 3 2 4 4 4 2 0 2.5-1 4-1s2 1 4 1c2 0 4-1 4-4 0-4-4-8-8-8z" />
    <ellipse cx="7" cy="13" rx="2.2" ry="3" />
    <ellipse cx="13" cy="7" rx="2.2" ry="3" />
    <ellipse cx="19" cy="7" rx="2.2" ry="3" />
    <ellipse cx="25" cy="13" rx="2.2" ry="3" />
  </>
);

const Popper = draw(
  <>
    <path d="M4 28L10 10l12 12z" {...ACCENT} />
    <path d="M4 28L10 10l12 12zM9 17l6 6" />
    <path d="M17 6v3M26 12h-3M21 11l2-2M24 19l3 1M14 4l1.5 2" />
    <circle cx="26" cy="5" r="1.4" fill="currentColor" stroke="none" />
  </>
);

const Receipt = draw(
  <>
    <path d="M7 3h18v26l-3-2-3 2-3-2-3 2-3-2-3 2z" {...ACCENT} />
    <path d="M7 3h18v26l-3-2-3 2-3-2-3 2-3-2-3 2zM12 10h8M12 15h8M12 20h4" />
  </>
);

const Mask = draw(
  <>
    <path d="M5 6c7 3 15 3 22 0 1 9 0 16-11 21C6 22 4 15 5 6z" {...ACCENT} />
    <path d="M5 6c7 3 15 3 22 0 1 9 0 16-11 21C6 22 4 15 5 6z" />
    <path d="M10 13c1.3-1 3-1 4 0M18 13c1.3-1 3-1 4 0M11 20c3 3 7 3 10 0" />
  </>
);

const Bomb = draw(
  <>
    <circle cx="14" cy="19" r="9" {...ACCENT} />
    <circle cx="14" cy="19" r="9" />
    <path d="M20 12l3-3M23 9c1-3 3-4 5-3M25 4v3M29 8h-3M9 17c1-2 3-3 5-3" />
  </>
);

const Laugh = draw(
  <>
    <circle cx="16" cy="16" r="12" {...ACCENT} />
    <circle cx="16" cy="16" r="12" />
    <path d="M9 18h14c0 5-3 7-7 7s-7-2-7-7zM10 11l3 1.5L10 14M22 11l-3 1.5 3 1.5" />
  </>
);

const Gem = draw(
  <>
    <path d="M9 5h14l6 8-13 15L3 13z" {...ACCENT} />
    <path d="M9 5h14l6 8-13 15L3 13zM3 13h26M12 13l4 15 4-15M12 13l-3-8M20 13l3-8" />
  </>
);

const Trophy = draw(
  <>
    <path d="M9 4h14v8a7 7 0 01-14 0z" {...ACCENT} />
    <path d="M9 4h14v8a7 7 0 01-14 0zM9 7H4c0 5 2 7 5 7M23 7h5c0 5-2 7-5 7M16 19v5M10 28h12M12 24h8" />
  </>
);

const Bracket = draw(
  <>
    <path d="M4 6h6v6H4M4 20h6v6H4M10 9h5v14h-5M15 16h4" />
    <circle cx="24" cy="16" r="5" {...ACCENT} />
    <circle cx="24" cy="16" r="5" />
    <path d="M24 13.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" />
  </>
);

const Signature = draw(
  <>
    <path d="M4 22c4-10 7-14 9-14 3 0-1 12 2 12 2 0 3-4 5-4s2 4 4 4 3-3 4-5" />
    <path d="M4 27h24" />
    <path d="M21 11l4-4 3 3-4 4z" {...ACCENT} />
  </>
);

const Podium = draw(
  <>
    <rect x="3" y="17" width="8" height="11" {...ACCENT} />
    <rect x="12" y="11" width="8" height="17" {...ACCENT} />
    <rect x="21" y="20" width="8" height="8" {...ACCENT} />
    <path d="M3 28V17h8v11M12 28V11h8v17M21 28V20h8v8M2 28h28" />
    <path d="M16 3.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="currentColor" stroke="none" />
  </>
);

const Heart = draw(
  <>
    <path d="M16 27C5 19 3 13 3 10a6.5 6.5 0 0113-1.5A6.5 6.5 0 0129 10c0 3-2 9-13 17z" {...ACCENT} />
    <path d="M16 27C5 19 3 13 3 10a6.5 6.5 0 0113-1.5A6.5 6.5 0 0129 10c0 3-2 9-13 17z" />
  </>
);

const History = draw(
  <>
    <circle cx="17" cy="16" r="11" {...ACCENT} />
    <path d="M6 16a11 11 0 1111 11M6 16l-3-3.5M6 16l3.5-2.5M17 10v6l4 2.5" />
  </>
);

const Hourglass = draw(
  <>
    <path d="M8 4h16M8 28h16M10 4c0 7 4 9 6 12-2 3-6 5-6 12M22 4c0 7-4 9-6 12 2 3 6 5 6 12" />
    <path d="M10 28c0-4 3-6 6-8 3 2 6 4 6 8z" {...ACCENT} />
  </>
);

const Chat = draw(
  <>
    <path d="M4 6h17a3 3 0 013 3v8a3 3 0 01-3 3H12l-5 5v-5H4a1 1 0 01-1-1V7a1 1 0 011-1z" {...ACCENT} />
    <path d="M4 6h17a3 3 0 013 3v8a3 3 0 01-3 3H12l-5 5v-5H4a1 1 0 01-1-1V7a1 1 0 011-1zM27 12a3 3 0 012 3v8a1 1 0 01-1 1h-3v4l-4-4h-4" />
  </>
);

export const BADGE_ICONS: Record<BadgeId, BadgeIcon> = {
  CHIRURGIEN: Check,
  HORLOGER: Buzzer,
  OEIL_DE_LYNX: Lynx,
  METRONOME: Metronome,
  MACHINE_A_PRONOS: Scroll,

  CHIRURGIEN_SERIE: Chain,
  SCOREUR_SERIE: Percent,
  VISIONNAIRE: Cards,
  COMPLETISTE: Network,
  SANS_FAUTE: Sparkles,

  SCOUT: Binoculars,
  COMPTABLE: Calculator,
  TACTICIEN: Playbook,
  MINUTEUR: Pie,
  DUELLISTE: Swords,
  CHRONOMETRE: Stopwatch,
  ASSEMBLEUR: Crowd,
  LIMIER: Paw,
  FANTAISISTE: Popper,
  ACCRO_DU_PARI: Receipt,
  MAINO: Mask,
  PRUDENT: die([[16, 16]]),
  JOUEUR: die([
    [11, 11],
    [21, 21],
  ]),
  CASSE_COU: die([
    [10.5, 10.5],
    [16, 16],
    [21.5, 21.5],
  ]),
  KAMIKAZE: Bomb,
  FOU_FURIEUX: Laugh,

  COLLECTIONNEUR: Gem,
  PRONOS_MASTER: Trophy,
  BRACKET_MASTER: Bracket,
  PARIS_PERSOS_MASTER: Signature,
  PODIUMISTA: Podium,

  FIDELE: Heart,
  VETERAN: History,
  DOYEN: Hourglass,

  SOCIABLE: Chat,
};
