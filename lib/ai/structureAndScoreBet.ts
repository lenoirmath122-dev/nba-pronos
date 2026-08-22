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
  const supabase = await getServerClient();

  /** Écrit is_calculable=false explicitement (jamais laissé NULL) -- bug
   *  réel trouvé le 21/08/2026 : le code s'arrêtait sans rien écrire dès
   *  que l'IA répondait "non calculable", rendant indistinguable "l'IA a
   *  tranché non" de "l'IA n'a jamais tourné" (panne, clé absente...).
   *  Fonctionnellement inoffensif (is_calculable ?? false partout en
   *  lecture) mais rendait tout diagnostic impossible. */
  async function markNotCalculable(): Promise<void> {
    try {
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: null,
        p_structured_player_id: null,
        p_stat: null,
        p_threshold: null,
        p_comparison: null,
        p_is_calculable: false,
        p_calculated_proba: null,
        p_suggested_difficulty: null,
      });
    } catch {
      // Best-effort, comme le reste de cette fonction.
    }
  }

  try {
    const teamNames = await resolveMatchTeamNames(supabase, seriesId);
    const structuration = await structureBet(description, teamNames);
    if (!structuration || !structuration.calculable || !structuration.player_name || !structuration.stat) {
      await markNotCalculable();
      return;
    }
    // comparison est légitimement null pour dd/td (NO_THRESHOLD_STATS,
    // probabilité directe) -- ne l'exiger que pour les stats à seuil. Bug
    // réel trouvé en testant le 21/08/2026 : la condition d'origine
    // exigeait comparison partout, faisant tomber TOUS les paris dd/td en
    // "non calculable" alors qu'ils le sont bel et bien.
    const stat = structuration.stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && !structuration.comparison) {
      await markNotCalculable();
      return;
    }

    // Joueur identifié mais absent des 2 équipes du match (bug réel trouvé
    // le 21/08/2026, ex. "LeBron James" sur un match Atlanta-Boston) --
    // proba forcée à 0% SANS appeler le micro-service (celui-ci ne connaît
    // pas le contexte du match, il calculerait une vraie proba à partir des
    // stats du joueur, ignorant qu'il ne joue pas ce soir-là -- exactement
    // le bug d'origine). Reste calculable=true (accepté, auto-validé,
    // perdra simplement à la résolution) plutôt que rejeté -- décidé avec
    // l'utilisateur pour ne jamais bloquer une soumission (même principe
    // que decisions_0.2.4 §4).
    if (structuration.player_not_in_match) {
      // p_structured_player_id: null -- le micro-service n'est jamais appelé
      // dans ce cas précis (voir plus bas), donc jamais de vrai player_id
      // résolu ici. Sans conséquence pour la résolution automatique (Phase
      // 6) : ce pari perd de toute façon à coup sûr (joueur absent du
      // match), pas besoin de retrouver sa vraie stat pour le savoir --
      // reste néanmoins non résolu automatiquement pour l'instant, noté
      // dans GAPS_OUVERTS.md comme amélioration possible.
      await supabase.rpc("update_bet_structuration", {
        p_bet_id: betId,
        p_structured_player_name: structuration.player_name,
        p_structured_player_id: null,
        p_stat: structuration.stat,
        p_threshold: structuration.threshold,
        p_comparison: structuration.comparison,
        p_is_calculable: true,
        p_calculated_proba: 0,
        p_suggested_difficulty: probaToDifficulty(0),
      });
      return;
    }

    const prediction = await predictOverUnder(
      structuration.player_name,
      stat,
      structuration.threshold,
      structuration.comparison,
    );
    if (!prediction) {
      await markNotCalculable();
      return;
    }

    const suggestedDifficulty = probaToDifficulty(prediction.proba);

    await supabase.rpc("update_bet_structuration", {
      p_bet_id: betId,
      p_structured_player_name: structuration.player_name,
      p_structured_player_id: prediction.playerId,
      p_stat: structuration.stat,
      p_threshold: structuration.threshold,
      p_comparison: structuration.comparison,
      p_is_calculable: true,
      p_calculated_proba: prediction.proba,
      p_suggested_difficulty: suggestedDifficulty,
    });
  } catch {
    // Best-effort : ne jamais faire échouer submitBet à cause de cette
    // étape d'enrichissement -- y compris si structureBet()/predictOverUnder()
    // lèvent une exception avant d'avoir pu répondre (timeout réseau...) :
    // on n'a alors même pas de réponse IA à enregistrer, is_calculable
    // reste NULL dans ce cas précis (panne, pas une décision).
  }
}
