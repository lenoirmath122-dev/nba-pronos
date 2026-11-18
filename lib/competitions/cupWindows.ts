// Fenêtres officielles de la NBA Cup 2026 (jours NY, source nba.com) : un
// match hors fenêtre ne peut pas être celui de la phase (ex. un match de
// saison régulière entre les mêmes équipes). Utilisé par la synchro
// calendrier pour ne jamais rattacher un tel match à une série de Cup.
export const CUP_ROUND_NY_WINDOWS: Record<string, readonly string[]> = {
  CUP_QUARTERS: ["2026-12-04", "2026-12-05"],
  CUP_SEMIS: ["2026-12-08", "2026-12-09"],
  CUP_FINAL: ["2026-12-11"],
};

/** `nyDay` : jour NY du match (YYYY-MM-DD). Tour inconnu → autorisé. */
export function cupRoundAllowsDay(round: string | null | undefined, nyDay: string): boolean {
  if (!round) return true;
  const window = CUP_ROUND_NY_WINDOWS[round];
  return window ? window.includes(nyDay) : true;
}
