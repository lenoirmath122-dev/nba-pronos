import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { NO_THRESHOLD_STATS, type StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, computeOutcome, resolveNbaGameId } from "./resolveBetsShared";

type EligibleSeriesBetRow = {
  id: string;
  series_id: string;
  structured_player_id: number | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Pièce (e) du chantier paris SÉRIE (23/08/2026, GAPS_OUVERTS.md) --
 *  équivalent SERIES de resolveCalculableBets() ci-dessus. Sémantique "au
 *  moins une fois sur la série" (retenue avec l'utilisateur, pièce (c)) :
 *  dès qu'UN match réellement joué de la série satisfait le seuil, le pari
 *  est gagné immédiatement -- pas besoin d'attendre la fin de la série. Si
 *  aucun hit pour l'instant, le pari n'est résolu LOST QUE si la série
 *  elle-même est terminée (`series.official_status = 'FINISHED'`, plus de
 *  match à venir qui pourrait encore faire gagner le pari) ET que tous ses
 *  matchs FINISHED ont bien une ligne stats_box_scores pour ce joueur (même
 *  prudence que resolveCalculableBets() : jamais trancher sur une absence
 *  de donnée -- si un match manque de données, le pari reste en attente
 *  plutôt que risquer un LOST à tort). */
export async function resolveCalculableSeriesBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, series_id, structured_player_id, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "SERIES")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_player_id", "is", null);
  const bets = (betsData ?? []) as EligibleSeriesBetRow[];
  if (bets.length === 0) return summary;

  const seriesIds = [...new Set(bets.map((b) => b.series_id))];

  const { data: seriesData } = await supabase.from("series").select("id, official_status").in("id", seriesIds);
  const seriesStatusById = new Map((seriesData ?? []).map((s) => [s.id as string, s.official_status as string]));

  const { data: matchesData } = await supabase.from("matches").select("id, series_id, status").in("series_id", seriesIds);
  const finishedMatchIdsBySeries = new Map<string, string[]>();
  for (const m of matchesData ?? []) {
    if (m.status !== "FINISHED") continue;
    const seriesId = m.series_id as string;
    finishedMatchIdsBySeries.set(seriesId, [...(finishedMatchIdsBySeries.get(seriesId) ?? []), m.id as string]);
  }

  // Paris déjà contestés -- jamais résolus automatiquement, même garde que
  // resolveCalculableBets() ci-dessus.
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
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (bet.structured_player_id === null || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "player_id ou stat manquant" });
      continue;
    }
    const stat = bet.structured_stat as StatCode;
    if (!NO_THRESHOLD_STATS.has(stat) && (bet.structured_threshold === null || bet.structured_comparison === null)) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const finishedMatchIds = finishedMatchIdsBySeries.get(bet.series_id) ?? [];
    let hit = false;
    let dataMissing = false;
    for (const matchId of finishedMatchIds) {
      const gameId = await resolveNbaGameId(supabase, matchId);
      if (!gameId) {
        dataMissing = true;
        continue;
      }
      const { data: box } = await supabase
        .from("stats_box_scores")
        .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov")
        .eq("game_id", gameId)
        .eq("player_id", bet.structured_player_id)
        .maybeSingle<BoxScoreRow>();
      if (!box) {
        // Pas encore synchronisé (ou joueur réellement absent de CE match
        // précis -- traded, DNP...) -- même prudence que resolveCalculableBets() :
        // ne bloque que la décision LOST, un hit sur un AUTRE match de la
        // série reste possible et prime de toute façon.
        dataMissing = true;
        continue;
      }
      if (computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, box)) {
        hit = true;
        break;
      }
    }

    if (!hit) {
      const seriesOver = seriesStatusById.get(bet.series_id) === "FINISHED";
      if (!seriesOver) {
        summary.skipped.push({ betId: bet.id, reason: "série pas encore terminée, pas encore de hit" });
        continue;
      }
      if (dataMissing || finishedMatchIds.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "données manquantes pour au moins un match de la série" });
        continue;
      }
    }

    const outcome: "WON" | "LOST" = hit ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: hit
          ? "Résolu automatiquement via les statistiques officielles d'un match de la série."
          : "Résolu automatiquement : série terminée, seuil jamais atteint sur les matchs joués.",
        resolved_at: new Date().toISOString(),
        resolved_by_admin_id: null,
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
