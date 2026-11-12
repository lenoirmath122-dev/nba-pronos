import type { BetDifficulty } from "@/lib/labels/bets";

// Seuils proba -> palier CALIBRÉS le 21/08/2026 (point 2 de SPEC_TECHNIQUE_
// PROBA_PARIS_PERSOS_V0_1.md §7bis), remplaçant les seuils provisoires
// "à vue de nez" (80/60/40/20%) posés au lancement de la Phase 5. Calibrage
// par quintile (20/40/60/80e percentile) sur un échantillon simulé de 62 280
// probas (868 joueurs réels x offsets autour de leur moyenne récente pour
// les stats à seuil, x seuils réalistes calés sur la moyenne ligue pour
// FT/FG/3P% -- Cadrage/Stats/scripts/calibrate_difficulty_thresholds.py),
// plutôt que d'attendre un vrai volume de paris joueurs (3 seulement à cette
// date). Palier bas = pari facile à gagner = peu de points
// (BET_DIFFICULTY_POINTS) ; palier haut = pari improbable = plus de points.
//
// Recalage du 12/11/2026 sur les vrais paris (120 résolus) : les paliers 3
// et 4 avaient presque le même taux de réussite réel (38 % et 33 %), un pari
// à ~39 % rapportait donc 20 points pour un risque de palier 3. Seuils des
// paliers 3/4 abaissés à 35 % et 20 % (39 % -> 15 points) ; paliers 1/2
// inchangés. Effet sur les paris de la saison 2026-27 : -5 % de points
// distribués. À revoir fin novembre : le palier 2 gagne ~80 % du temps.
const CALIBRATED_THRESHOLDS: { minProba: number; difficulty: BetDifficulty }[] = [
  { minProba: 0.664, difficulty: 1 },
  { minProba: 0.529, difficulty: 2 },
  { minProba: 0.35, difficulty: 3 },
  { minProba: 0.2, difficulty: 4 },
  { minProba: 0, difficulty: 5 },
];

export function probaToDifficulty(proba: number): BetDifficulty {
  const clamped = Math.min(1, Math.max(0, proba));
  const tier = CALIBRATED_THRESHOLDS.find((t) => clamped >= t.minProba);
  return tier?.difficulty ?? 5;
}
