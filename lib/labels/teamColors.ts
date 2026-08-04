// Couleurs officielles (primaire/secondaire) des 30 franchises NBA, par
// abréviation (même clé que public/logos/teams/{ABBREVIATION}.svg,
// lib/queries/matches.ts::TeamRef). Constante de code, PAS une colonne base
// — même choix que lib/labels/rounds.ts : ces valeurs ne dépendent d'aucune
// donnée compétition/utilisateur, un fichier statique évite une migration
// pour de la donnée qui ne change jamais en cours de saison.
//
// Sert UNIQUEMENT à la personnalisation du bandeau Profil par équipe
// favorite (04/08/2026, spec validée par maquettes) — cf.
// app/(app)/profile/page.tsx. Périmètre volontairement limité à cet écran
// (essai précédent du 30/07/2026 sur Profil entier, abandonné) : ne pas
// réutiliser ailleurs sans le redemander explicitement à l'utilisateur.

export type TeamColors = { primary: string; secondary: string };

export const TEAM_COLORS: Record<string, TeamColors> = {
  ATL: { primary: "#E03A3E", secondary: "#C1D32F" },
  BOS: { primary: "#007A33", secondary: "#BA9653" },
  BKN: { primary: "#000000", secondary: "#707271" },
  CHA: { primary: "#1D1160", secondary: "#00788C" },
  CHI: { primary: "#CE1141", secondary: "#000000" },
  CLE: { primary: "#860038", secondary: "#FDBB30" },
  DAL: { primary: "#00538C", secondary: "#B8C4CA" },
  DEN: { primary: "#0E2240", secondary: "#FEC524" },
  DET: { primary: "#C8102E", secondary: "#1D42BA" },
  GSW: { primary: "#1D428A", secondary: "#FFC72C" },
  HOU: { primary: "#CE1141", secondary: "#000000" },
  IND: { primary: "#002D62", secondary: "#FDBB30" },
  LAC: { primary: "#C8102E", secondary: "#1D428A" },
  LAL: { primary: "#552583", secondary: "#FDB927" },
  MEM: { primary: "#5D76A9", secondary: "#F5B112" },
  MIA: { primary: "#98002E", secondary: "#F9A01B" },
  MIL: { primary: "#00471B", secondary: "#EEE1C6" },
  MIN: { primary: "#0C2340", secondary: "#78BE20" },
  NOP: { primary: "#0C2340", secondary: "#C8102E" },
  NYK: { primary: "#006BB6", secondary: "#F58426" },
  OKC: { primary: "#007AC1", secondary: "#EF3B24" },
  ORL: { primary: "#0077C0", secondary: "#C4CED4" },
  PHI: { primary: "#006BB6", secondary: "#ED174C" },
  PHX: { primary: "#1D1160", secondary: "#E56020" },
  POR: { primary: "#E03A3E", secondary: "#000000" },
  SAC: { primary: "#5A2D81", secondary: "#63727A" },
  SAS: { primary: "#C4CED4", secondary: "#000000" },
  TOR: { primary: "#CE1141", secondary: "#000000" },
  UTA: { primary: "#002B5C", secondary: "#F9A01B" },
  WAS: { primary: "#002B5C", secondary: "#E31837" },
};
