import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { type ResolveBetsSummary, resolveNbaGameId, resolveNbaTeamId } from "./resolveBetsShared";

// ============================================================================
// Chantier "fautes techniques équipe/match, comptage exact" (étape 5,
// GAPS_OUVERTS.md).
// ============================================================================

type StructuredTechnicalFoulsCount = {
  scope: "MATCH" | "team1" | "team2";
  count_relation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN" | "EXACTLY";
};

type EligibleTechnicalFoulsCountBetRow = {
  id: string;
  match_id: string | null;
  structured_team_id: string | null;
  structured_threshold: number | null;
  structured_technical_fouls_count: StructuredTechnicalFoulsCount | null;
};

/** Résolution des paris TECHNICAL_FOULS_COUNT -- somme
 *  stats_box_scores.technical_fouls (scope=MATCH : les 2 équipes, sans
 *  filtre team_id, même geste que resolveCalculableSuperlativeBets()/
 *  resolveCalculableGameEventBets() [had_backcourt_turnover] ; scope=team1/
 *  team2 : filtré par team_id via resolveNbaTeamId(), même pont que
 *  resolveCalculableTeamStatBets()). MATCH uniquement, même limite que les
 *  autres resolvers. */
export async function resolveCalculableTechnicalFoulsCountBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_team_id, structured_threshold, structured_technical_fouls_count")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_technical_fouls_count", "is", null);
  const bets = (betsData ?? []) as EligibleTechnicalFoulsCountBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

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
    const tfc = bet.structured_technical_fouls_count;
    if (!tfc || bet.structured_threshold === null) {
      summary.skipped.push({ betId: bet.id, reason: "comptage fautes techniques structuré manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    let rows: { technical_fouls: number | null }[] | null;
    if (tfc.scope === "MATCH") {
      ({ data: rows } = await supabase.from("stats_box_scores").select("technical_fouls").eq("game_id", gameId));
    } else {
      const nbaTeamId = bet.structured_team_id ? await resolveNbaTeamId(supabase, bet.structured_team_id) : null;
      if (nbaTeamId === null) {
        summary.skipped.push({ betId: bet.id, reason: "équipe NBA correspondante introuvable" });
        continue;
      }
      ({ data: rows } = await supabase.from("stats_box_scores").select("technical_fouls").eq("game_id", gameId).eq("team_id", nbaTeamId));
    }
    if (!rows || rows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }
    const total = rows.reduce((sum, r) => sum + (r.technical_fouls ?? 0), 0);
    const threshold = bet.structured_threshold;
    const won =
      tfc.count_relation === "EXACTLY" ? total === threshold
      : tfc.count_relation === "AT_LEAST" ? total >= threshold
      : tfc.count_relation === "MORE_THAN" ? total > threshold
      : total < threshold;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${total} fautes techniques).`,
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
