// Seuils des badges permanents (Cadrage/V1/Spec visuelle/
// SPEC_BADGES_PERMANENTS_V0_1.md §3/§4) — SANS AUCUNE dépendance serveur
// (pas de getServerClient/next-headers), même contrainte que
// lib/labels/bets.ts : consommé par des composants serveur ET (un jour)
// client sans casser le build. Namespace VOLONTAIREMENT séparé de
// lib/labels/bets.ts (BET_DIFFICULTY_POINTS notamment) — un badge et un
// libellé de formulaire ne portent jamais la même signification (spec §0).
//
// Phase 1 (25 badges) + phase 2 (Métronome, Pilier) + phase 3 (Fidèle —
// 09/08/2026, catalogue de base désormais complet). Seul Grimpeur
// (progression de rang) reste hors périmètre, cf. §7 de la spec.
//
// Pilier RETIRÉ le 10/08/2026 (migration #28) : sa description révisée par
// l'utilisateur ("participation d'affilée, prono ou pari") s'est révélée
// identique à la définition déjà codée de Fidèle (union pronostic OU pari
// MATCH) — fusionnés en un seul badge, Fidèle garde le nom et le visuel.

export type BadgeTier = "BRONZE" | "ARGENT" | "OR" | "PLATINE" | "DIAMANT";

export type TieredBadgeId =
  // I. Pronostics de match
  | "CHIRURGIEN"
  | "HORLOGER"
  | "OEIL_DE_LYNX"
  | "METRONOME"
  | "MACHINE_A_PRONOS"
  // II. Bracket personnel
  | "CHIRURGIEN_SERIE"
  | "SCOREUR_SERIE"
  | "VISIONNAIRE"
  | "SANS_FAUTE"
  // III. Paris perso — 9 catégories + 2 volume
  | "SCOUT"
  | "COMPTABLE"
  | "TACTICIEN"
  | "MINUTEUR"
  | "DUELLISTE"
  | "CHRONOMETRE"
  | "ASSEMBLEUR"
  | "LIMIER"
  | "FANTAISISTE"
  | "ACCRO_DU_PARI"
  | "MAINO"
  // IV. Classement global
  | "COLLECTIONNEUR"
  | "PRONOS_MASTER"
  | "BRACKET_MASTER"
  | "PARIS_PERSOS_MASTER"
  | "PODIUMISTA"
  // V. Fidélité / régularité
  | "FIDELE"
  | "VETERAN"
  | "DOYEN";

export type BinaryBadgeId = "COMPLETISTE" | "SOCIABLE";

export type LadderBadgeId = "PRUDENT" | "JOUEUR" | "CASSE_COU" | "KAMIKAZE" | "FOU_FURIEUX";

export type BadgeId = TieredBadgeId | BinaryBadgeId | LadderBadgeId;

/** [Bronze, Argent, Or, Platine, Diamant] — croissance ~×2.5/×2/×2/×1.7. */
type TierThresholds = readonly [number, number, number, number, number];

export const TIERED_BADGE_THRESHOLDS: Record<TieredBadgeId, TierThresholds> = {
  CHIRURGIEN: [10, 25, 50, 100, 200],
  HORLOGER: [3, 8, 15, 30, 50],
  OEIL_DE_LYNX: [8, 20, 40, 75, 150],
  // Record personnel de la plus longue série jamais obtenue (streak à
  // l'intérieur d'une compétition, max réduit côté TypeScript entre
  // compétitions — jamais de régression, cf. lib/queries/badges.ts).
  METRONOME: [3, 5, 8, 12, 20],
  MACHINE_A_PRONOS: [5, 15, 35, 70, 120],

  CHIRURGIEN_SERIE: [3, 8, 15, 30, 50],
  SCOREUR_SERIE: [2, 5, 10, 20, 35],
  VISIONNAIRE: [1, 3, 6, 12, 20],
  SANS_FAUTE: [1, 3, 6, 12, 20],

  SCOUT: [3, 8, 15, 25, 40],
  COMPTABLE: [3, 8, 15, 25, 40],
  TACTICIEN: [3, 8, 15, 25, 40],
  MINUTEUR: [3, 8, 15, 25, 40],
  DUELLISTE: [3, 8, 15, 25, 40],
  CHRONOMETRE: [3, 8, 15, 25, 40],
  ASSEMBLEUR: [3, 8, 15, 25, 40],
  LIMIER: [3, 8, 15, 25, 40],
  FANTAISISTE: [3, 8, 15, 25, 40],
  ACCRO_DU_PARI: [5, 15, 35, 70, 120],
  MAINO: [2, 5, 10, 20, 35],

  COLLECTIONNEUR: [100, 500, 1500, 4000, 10000],
  PRONOS_MASTER: [50, 200, 600, 1500, 3500],
  BRACKET_MASTER: [50, 200, 600, 1500, 3500],
  PARIS_PERSOS_MASTER: [50, 200, 600, 1500, 3500],
  PODIUMISTA: [3, 10, 25, 50, 100],

  // Record personnel de la plus longue série sans absence, pronostics ET
  // paris confondus (union — un pari MATCH rattaché au match précis compte
  // autant qu'un pronostic ; un pari SÉRIE ne compte jamais, cf. migration
  // #27). Streak à l'intérieur d'une compétition, max réduit côté
  // TypeScript entre compétitions, même patron que Métronome. Absorbe
  // l'ancien badge Pilier depuis le 10/08/2026 (migration #28, fusion).
  FIDELE: [5, 15, 30, 50, 80],

  VETERAN: [1, 2, 4, 6, 10],
  // Ancienneté du compte en JOURS (1 mois/3 mois/6 mois/1 an/2 ans,
  // approximés à 30/91/182/365/730 jours) — comparé à
  // (now() - users.created_at) calculé côté requête (lib/queries/badges.ts).
  DOYEN: [30, 91, 182, 365, 730],
};

// Échelle dédiée "prise de risque" (spec §4.III) — 5 badges DISTINCTS, un
// par niveau de difficulté de pari (1 à 5), PAS un badge à 5 paliers
// Bronze→Diamant. Même seuil pour les 5 par simplicité (à ajuster si un
// niveau se révèle trop rare en usage réel — spec §4, note explicite).
export const LADDER_BADGE_THRESHOLD: Record<LadderBadgeId, { difficulty: 1 | 2 | 3 | 4 | 5; threshold: number }> = {
  PRUDENT: { difficulty: 1, threshold: 5 },
  JOUEUR: { difficulty: 2, threshold: 5 },
  CASSE_COU: { difficulty: 3, threshold: 5 },
  KAMIKAZE: { difficulty: 4, threshold: 5 },
  FOU_FURIEUX: { difficulty: 5, threshold: 5 },
};

/** Palier atteint pour une valeur cumulée donnée, ou null si sous le seuil Bronze. */
export function resolveTier(value: number, thresholds: TierThresholds): BadgeTier | null {
  const [bronze, argent, or_, platine, diamant] = thresholds;
  if (value >= diamant) return "DIAMANT";
  if (value >= platine) return "PLATINE";
  if (value >= or_) return "OR";
  if (value >= argent) return "ARGENT";
  if (value >= bronze) return "BRONZE";
  return null;
}

/** Prochain seuil à atteindre, ou null si Diamant déjà atteint (badge au maximum). */
export function nextThreshold(value: number, thresholds: TierThresholds): number | null {
  for (const t of thresholds) {
    if (value < t) return t;
  }
  return null;
}
