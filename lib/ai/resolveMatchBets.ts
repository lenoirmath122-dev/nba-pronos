import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, computeOutcome, resolveNbaGameId, isBoxScoreSynced, DNP_RESOLUTION_REASON } from "./resolveBetsShared";

type EligibleBetRow = {
  id: string;
  match_id: string | null;
  structured_player_id: number | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Point d'entrée appelé par /api/resolve-bets (chaîné après le
 *  rafraîchissement quotidien Data NBA, GAPS_OUVERTS.md/JOURNAL_SESSIONS.md
 *  -- les vraies stats de la veille doivent être en base AVANT de tenter
 *  une résolution, sinon tout échoue en "pas de ligne stats_box_scores"). */
export async function resolveCalculableBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_player_id, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_player_id", "is", null);
  const bets = (betsData ?? []) as EligibleBetRow[];
  if (bets.length === 0) return summary;

  // Ne retient que les matchs FINISHED (matcher un match pas encore joué
  // n'aurait aucune stat_box_scores de toute façon) -- une seule requête
  // pour tous les bets de cette passe plutôt qu'une par bet.
  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  // Paris déjà contestés (requête de correction en attente) -- jamais
  // résolus automatiquement, même garde que resolveBet() (admin-resolution.ts).
  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map((b) => b.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const bet of bets) {
    if (!bet.match_id || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (bet.structured_player_id === null || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "player_id ou stat manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const { data: box } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov")
      .eq("game_id", gameId)
      .eq("player_id", bet.structured_player_id)
      .maybeSingle<BoxScoreRow>();
    // Pas de ligne : soit le box score du match n'est pas encore importé
    // (on réessaiera à la prochaine passe quotidienne), soit il l'est et le
    // joueur n'a pas joué -> LOST (p3-15, cf. isBoxScoreSynced()).
    if (!box && !(await isBoxScoreSynced(supabase, gameId))) {
      summary.skipped.push({ betId: bet.id, reason: "pas de ligne stats_box_scores pour ce joueur/match" });
      continue;
    }

    const won = box
      ? computeOutcome(bet.structured_stat as StatCode, bet.structured_threshold, bet.structured_comparison, box)
      : false;
    if (won === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: box ? "Résolu automatiquement via les statistiques officielles du match." : DNP_RESOLUTION_REASON,
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null, // signal "résolu par le système", pas un humain -- même convention que validated_by_admin_id
      })
      .eq("id", bet.id)
      .eq("status", "VALIDATED")
      .select("id")
      .maybeSingle();
    if (!updated) {
      summary.skipped.push({ betId: bet.id, reason: "déjà résolu entre-temps (concurrence)" });
      continue;
    }

    await recomputeBet(bet.id);
    summary.resolved.push({ betId: bet.id, outcome });
  }

  return summary;
}
