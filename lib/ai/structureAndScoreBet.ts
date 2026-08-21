import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import { structureBet } from "./structureBet";
import { predictOverUnder } from "./statsService";
import { probaToDifficulty } from "./difficultyTiers";
import { NO_THRESHOLD_STATS, type StatCode } from "./statCodes";

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
    if (!structuration || !structuration.calculable || !structuration.player_name || !structuration.stat) {
      return;
    }
    // comparison est légitimement null pour dd/td (NO_THRESHOLD_STATS,
    // probabilité directe) -- ne l'exiger que pour les stats à seuil. Bug
    // réel trouvé en testant le 21/08/2026 : la condition d'origine
    // exigeait comparison partout, faisant tomber TOUS les paris dd/td en
    // "non calculable" alors qu'ils le sont bel et bien.
    const stat = structuration.stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && !structuration.comparison) {
      return;
    }

    const prediction = await predictOverUnder(
      structuration.player_name,
      stat,
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
