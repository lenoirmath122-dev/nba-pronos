import { MARGIN_BONUS_DISPLAY_TIERS, MATCH_WINNER_POINTS } from "@/lib/scoring/engine";

// Points en jeu affichés sous le curseur d'écart. Tout vient du barème du moteur
// (engine.ts) : jamais de valeur écrite ici. Le barème d'écart a 4 paliers, trop
// pour une ligne : on affiche le bon vainqueur, l'écart exact et le premier palier « proche ».
export function stakesLine(): string {
  const [exact, close] = MARGIN_BONUS_DISPLAY_TIERS;
  const bonus = (t: { label: string; points: number }) => `${t.label.toLowerCase()} +${t.points}`;
  return `bon vainqueur ${MATCH_WINNER_POINTS} pts, ${bonus(exact)}, ${bonus(close)}`;
}
