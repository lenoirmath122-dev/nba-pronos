import type { BetDifficulty } from "@/lib/labels/bets";

// Seuils proba -> palier PROVISOIRES ("à vue de nez", décidé le 21/08/2026
// avec l'utilisateur) -- le point 2 de SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_
// V0_1.md §7 (vraie distribution de probas sur un échantillon de paris réels
// pour calibrer par quintile) n'est pas encore fait. Palier bas = pari facile
// à gagner = peu de points (BET_DIFFICULTY_POINTS) ; palier haut = pari
// improbable = plus de points. À RECALIBRER une fois assez de paris réels
// structurés pour observer la vraie distribution des probas calculées.
const PROVISIONAL_THRESHOLDS: { minProba: number; difficulty: BetDifficulty }[] = [
  { minProba: 0.8, difficulty: 1 },
  { minProba: 0.6, difficulty: 2 },
  { minProba: 0.4, difficulty: 3 },
  { minProba: 0.2, difficulty: 4 },
  { minProba: 0, difficulty: 5 },
];

export function probaToDifficulty(proba: number): BetDifficulty {
  const clamped = Math.min(1, Math.max(0, proba));
  const tier = PROVISIONAL_THRESHOLDS.find((t) => clamped >= t.minProba);
  return tier?.difficulty ?? 5;
}
