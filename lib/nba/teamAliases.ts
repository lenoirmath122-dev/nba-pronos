// Table figée des 30 vraies franchises NBA (id numérique Highlightly ↔ notre
// `teams.abbreviation`), construite à la main le 28/07/2026 à partir d'un
// appel réel à GET /teams. Existe UNIQUEMENT parce que league="NBA" côté
// Highlightly ne suffit PAS à isoler les 30 franchises (voir en-tête de
// lib/nba/client.ts et le correctif SPEC_TECHNIQUE_SYNCHRO_V0.1 §4/§12.4) :
// - 6 abréviations Highlightly diffèrent des nôtres (déjà committées, câblées
//   aux 30 SVG de public/logos/teams/ et à tous les FK de l'app) : NY↔NYK,
//   GS↔GSW, NO↔NOP, SA↔SAS, UTAH↔UTA, WSH↔WAS.
// - league="NBA" inclut aussi des entités hors référentiel réel (équipes
//   All-Star "Team Durant"/"Team Giannis"/"Team LeBron"/"Western Conf
//   All-Stars"/"Eastern Conf All-Stars", "World", l'internationale "NEWZEALAND
//   Breakers") — un filtre même conjugué à "logo présent" en laisse passer 7.
//
// Décision actée avec l'utilisateur (28/07/2026) : notre table `teams`
// EXISTANTE reste la source de vérité pour name/abbreviation/logo — ce module
// ne sert qu'à retrouver, pour chacune de nos 30 lignes, l'id Highlightly
// correspondant, afin d'écrire entity_mappings (CONFIRMED direct, 0.2.8 §5 —
// le référentiel des 30 franchises reste déterministe). Tout id Highlightly
// absent de cette table est ignoré par lib/sync/teams.ts, jamais inséré en
// PENDING (ce n'est structurellement pas une entité de jeu).
export const HIGHLIGHTLY_TEAM_ID_BY_ABBREVIATION: Readonly<Record<string, number>> = {
  ATL: 23,
  BOS: 2,
  BKN: 49,
  CHA: 33,
  CHI: 27,
  CLE: 35,
  DAL: 40,
  DEN: 3,
  DET: 25,
  GSW: 43,
  HOU: 28,
  IND: 36,
  LAC: 30,
  LAL: 4,
  MEM: 42,
  MIA: 1,
  MIL: 39,
  MIN: 41,
  NOP: 64,
  NYK: 26,
  OKC: 38,
  ORL: 24,
  PHI: 71,
  PHX: 46,
  POR: 31,
  SAC: 32,
  SAS: 37,
  TOR: 34,
  UTA: 45,
  WAS: 50,
};
