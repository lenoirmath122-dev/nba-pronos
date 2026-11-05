import type { FormLabel, PlayerSeasonLine, PlayerTrend } from "./types";

// Règles d'affichage dérivées (CHANTIER_AIDE_DEBUTANTS.md §5.4), calculées ici
// et non en base pour pouvoir ajuster les seuils sans migration (D5).

export const MIN_GAMES_FOR_FORM = 3;
export const FORM_WINDOW = 5;
export const FORM_EN_FEU = 0.8;
export const FORM_EN_FORME = 0.6;
export const FORM_IRREGULIERE = 0.4;
export const EARLY_SEASON_GAMES = 10;
export const TREND_MIN_GAMES = 8;
export const TREND_MIN_DELTA = 3;
export const TREND_RATIO_UP = 1.2;
export const TREND_RATIO_DOWN = 0.8;
export const KEY_PLAYERS_COUNT = 3;
export const KEY_PLAYER_MIN_SHARE = 0.5;
export const USUAL_STARTER_SHARE = 0.5;

export function formLabel(gamesPlayed: number, last5Wins: number): FormLabel {
  if (gamesPlayed < MIN_GAMES_FOR_FORM) return "DEBUT";
  const n = Math.min(FORM_WINDOW, gamesPlayed);
  const ratio = last5Wins / n;
  if (ratio >= FORM_EN_FEU) return "EN_FEU";
  if (ratio >= FORM_EN_FORME) return "EN_FORME";
  if (ratio >= FORM_IRREGULIERE) return "IRREGULIERE";
  return "EN_DIFFICULTE";
}

export function isEarlySeason(gamesPlayed: number): boolean {
  return gamesPlayed < EARLY_SEASON_GAMES;
}

export function playerTrend(input: {
  gamesPlayed: number;
  last5Games: number;
  ptsAvg: number;
  last5PtsAvg: number;
}): PlayerTrend | null {
  const { gamesPlayed, last5Games, ptsAvg, last5PtsAvg } = input;
  if (gamesPlayed < TREND_MIN_GAMES || last5Games < FORM_WINDOW) return null;
  if (last5PtsAvg - ptsAvg >= TREND_MIN_DELTA && last5PtsAvg >= TREND_RATIO_UP * ptsAvg) return "EN_HAUSSE";
  if (ptsAvg - last5PtsAvg >= TREND_MIN_DELTA && last5PtsAvg <= TREND_RATIO_DOWN * ptsAvg) return "EN_BAISSE";
  return "STABLE";
}

export function isUsualStarter(gamesStarted: number, gamesPlayed: number): boolean {
  return gamesPlayed > 0 && gamesStarted / gamesPlayed >= USUAL_STARTER_SHARE;
}

/** Les 3 joueurs mis en avant : assez de matchs avec l'équipe, tri pts puis minutes. */
export function selectKeyPlayers(roster: PlayerSeasonLine[], teamGamesPlayed: number): PlayerSeasonLine[] {
  const minGames = Math.max(1, Math.ceil(KEY_PLAYER_MIN_SHARE * teamGamesPlayed));
  return roster
    .filter((p) => p.gamesWithTeam >= minGames)
    .sort((a, b) => b.pts - a.pts || b.minutes - a.minutes)
    .slice(0, KEY_PLAYERS_COUNT);
}
