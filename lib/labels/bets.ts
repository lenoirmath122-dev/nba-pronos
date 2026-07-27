// Constantes de l'écran "Nouveau pari" SANS AUCUNE dépendance serveur (pas de
// getServerClient/next-headers) — consommées à la fois par lib/queries/bets.ts
// (composants serveur) et components/bets/BetForm.tsx ("use client", §1.1) :
// un import runtime de valeurs (pas seulement de types) depuis un module qui
// importe next/headers ferait échouer le build ("next/headers dans un
// composant client"). Même rôle que lib/labels/rounds.ts.

export type BetCategory =
  | "PLAYER_PROP"
  | "SCORE_TOTAL"
  | "TEAM_PROP"
  | "PERIOD"
  | "HEAD_TO_HEAD"
  | "PLAYING_TIME"
  | "MULTI_PLAYER_COMBO"
  | "GAME_EVENT"
  | "FUN_OFF_COURT";

export type BetDifficulty = 1 | 2 | 3 | 4 | 5;

// 9 catégories fixes (C3), libellés FR — §5.2, ordre de la spec.
export const BET_CATEGORY_OPTIONS: { value: BetCategory; label: string }[] = [
  { value: "PLAYER_PROP", label: "Pari joueur" },
  { value: "SCORE_TOTAL", label: "Score / total match" },
  { value: "TEAM_PROP", label: "Pari équipe" },
  { value: "PERIOD", label: "Pari période" },
  { value: "HEAD_TO_HEAD", label: "Comparaison / duel" },
  { value: "PLAYING_TIME", label: "Rotation / temps de jeu" },
  { value: "MULTI_PLAYER_COMBO", label: "Combo multi-joueurs" },
  { value: "GAME_EVENT", label: "Événement de match" },
  { value: "FUN_OFF_COURT", label: "Fun / hors terrain" },
];

// 5 niveaux (0.2.4 §7) — §5.3.
export const BET_DIFFICULTY_LABELS: Record<BetDifficulty, string> = {
  1: "Très accessible",
  2: "Accessible",
  3: "Intermédiaire",
  4: "Difficile",
  5: "Jackpot",
};

// Défauts d'un brouillon, actés le 26/07/2026 (§5.4).
export const DEFAULT_BET_CATEGORY: BetCategory = "PLAYER_PROP";
export const DEFAULT_BET_DIFFICULTY: BetDifficulty = 3;

// Cap de slots MATCH par série, Playoffs uniquement (§6.1) ; sans effet Cup
// (pas de cap série). Source unique du chiffre, lue par le bootstrap serveur
// ET par l'affichage client (ex. "2/3 slots").
export const MATCH_SLOT_CAP = 3;
