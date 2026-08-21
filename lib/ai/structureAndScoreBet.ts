import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { structureBet } from "./structureBet";
import { predictOverUnder } from "./statsService";
import { probaToDifficulty } from "./difficultyTiers";

// Orchestre la structuration IA + le calcul de proba pour UN pari, à la
// soumission (SPEC_TECHNIQUE_PROBA_PARIS_PERSOS_V0_1.md §3/§6, décidé le
// 21/08/2026 : synchrone, figé à la soumission -- jamais recalculé après).
// Appelée depuis submitBet APRÈS que le pari existe déjà en base
// (save_bet a réussi) -- toute panne ici (IA, service Cloud Run, réseau)
// est avalée silencieusement : le pari reste soumis normalement, avec le
// mécanisme manuel existant (difficulté proposée/validée à la main) comme
// seul repli, jamais bloquant pour le joueur.
export async function structureAndScoreBet(betId: string, description: string): Promise<void> {
  try {
    const structuration = await structureBet(description);
    if (!structuration || !structuration.calculable || !structuration.player_name || !structuration.stat || !structuration.comparison) {
      return;
    }

    const prediction = await predictOverUnder(
      structuration.player_name,
      structuration.stat as Parameters<typeof predictOverUnder>[1],
      structuration.threshold,
      structuration.comparison,
    );
    if (!prediction) return;

    const suggestedDifficulty = probaToDifficulty(prediction.proba);

    const supabase = await getServerClient();
    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: structuration.player_name,
      p_stat: structuration.stat,
      p_threshold: structuration.threshold,
      p_comparison: structuration.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: suggestedDifficulty,
    });
  } catch {
    // Best-effort : ne jamais faire échouer submitBet à cause de cette
    // étape d'enrichissement.
  }
}
