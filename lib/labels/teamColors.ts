// Couleur primaire officielle de chaque équipe NBA (BACKLOG_V1.md
// « Personnalisation du profil »), constante de code — même convention que
// les logos de franchise (public/logos/teams/{ABBRÉVIATION}.svg, déduits
// par abréviation, aucune colonne teams.* dédiée). Fait public de branding,
// pas un asset protégé — comme les abréviations déjà en dur ailleurs.
export const TEAM_COLORS: Record<string, string> = {
  ATL: "#E03A3E",
  BKN: "#000000",
  BOS: "#007A33",
  CHA: "#1D1160",
  CHI: "#CE1141",
  CLE: "#860038",
  DAL: "#00538C",
  DEN: "#0E2240",
  DET: "#C8102E",
  GSW: "#1D428A",
  HOU: "#CE1141",
  IND: "#002D62",
  LAC: "#C8102E",
  LAL: "#552583",
  MEM: "#5D76A9",
  MIA: "#98002E",
  MIL: "#00471B",
  MIN: "#0C2340",
  NOP: "#0C2340",
  NYK: "#006BB6",
  OKC: "#007AC1",
  ORL: "#0077C0",
  PHI: "#006BB6",
  PHX: "#1D1160",
  POR: "#E03A3E",
  SAC: "#5A2D81",
  SAS: "#C4CED4",
  TOR: "#CE1141",
  UTA: "#002B5C",
  WAS: "#002B5C",
};

/** "#RRGGBB" -> "R, G, B" (nécessaire pour rgba(var(--x), alpha) en CSS —
 *  un custom property ne peut porter qu'UNE valeur, pas un hex complet dans
 *  un rgba()). Utilisé pour le voile du bandeau (--hero-overlay-rgb). */
export function hexToRgbTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
