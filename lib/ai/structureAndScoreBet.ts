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

/** Bug réel corrigé le 21/08/2026 : sans le contexte du match, l'IA validait
 *  des paris sur des joueurs qui ne jouent même pas dans le match visé
 *  (ex. "Jayson Tatum" sur un match Nets-Hornets). Résolu depuis
 *  series.team1_id/team2_id -- null si pas encore connus (série pas
 *  déterminée), structureBet() se rabat alors sur l'ancien comportement
 *  sans vérification d'équipe. */
async function resolveMatchTeamNames(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  seriesId: string,
): Promise<[string, string] | null> {
  const { data: series } = await supabase
    .from("series")
    .select("team1_id, team2_id")
    .eq("id", seriesId)
    .maybeSingle<{ team1_id: string | null; team2_id: string | null }>();
  if (!series?.team1_id || !series?.team2_id) return null;

  const { data: teams } = await supabase.from("teams").select("id, name").in("id", [series.team1_id, series.team2_id]);
  const nameById = new Map((teams ?? []).map((t) => [t.id as string, t.name as string]));
  const name1 = nameById.get(series.team1_id);
  const name2 = nameById.get(series.team2_id);
  return name1 && name2 ? [name1, name2] : null;
}

export async function structureAndScoreBet(betId: string, description: string, seriesId: string): Promise<void> {
  try {
    const supabase = await getServerClient();
    const teamNames = await resolveMatchTeamNames(supabase, seriesId);
    const structuration = await structureBet(description, teamNames);
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
