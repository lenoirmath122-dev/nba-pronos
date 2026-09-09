import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { type ResolveBetsSummary, resolveNbaGameId } from "./resolveBetsShared";

// Chantier "événements granulaires" (étape 6 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- LAST_BASKET ("X inscrit le dernier panier
// du match"). Voir aussi resolveBlockOnPlayerBets.ts (BLOCK_ON_PLAYER),
// même chantier d'origine.
type EligibleLastBasketBetRow = {
  id: string;
  match_id: string | null;
  structured_player_id: number | null;
  structured_last_basket: boolean | null;
};

/** Résolution des paris LAST_BASKET -- lit stats_matchs.last_basket_player_id
 *  (personId du dernier "Made Shot" du match, agrégé à la synchro, cf.
 *  refresh_daily.py/backfill_game_events.py) et compare au joueur visé
 *  (structured_player_id, comme SUPERLATIVE/PLAYER classique). MATCH
 *  uniquement, même limite que les autres resolvers. */
export async function resolveCalculableLastBasketBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_player_id, structured_last_basket")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .eq("structured_last_basket", true);
  const bets = (betsData ?? []) as EligibleLastBasketBetRow[];
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
    if (!bet.match_id || bet.structured_player_id === null || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: bet.match_id && finishedMatchIds.has(bet.match_id) ? "dernier panier structuré manquant" : "match pas encore terminé" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const { data: match } = await supabase
      .from("stats_matchs")
      .select("last_basket_player_id")
      .eq("game_id", gameId)
      .maybeSingle<{ last_basket_player_id: number | null }>();
    if (!match || match.last_basket_player_id === null) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const outcome: "WON" | "LOST" = match.last_basket_player_id === bet.structured_player_id ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: "Résolu automatiquement via les statistiques officielles du match (dernier panier du match).",
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
