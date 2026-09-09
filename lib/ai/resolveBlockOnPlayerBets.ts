import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { type ResolveBetsSummary, resolveNbaGameId } from "./resolveBetsShared";

type StructuredBlockOnPlayer = { blocker_player_id: number; victim_player_id: number };

type EligibleBlockOnPlayerBetRow = {
  id: string;
  match_id: string | null;
  structured_block_on_player: StructuredBlockOnPlayer | null;
};

/** Résolution des paris BLOCK_ON_PLAYER -- lit stats_block_events (table
 *  d'événements, 1 ligne par contre, agrégée à la synchro depuis le
 *  play-by-play -- cf. refresh_daily.py/backfill_game_events.py), gagné dès
 *  qu'AU MOINS UNE ligne (game_id, blocker_player_id, victim_player_id)
 *  correspond. MATCH uniquement, même limite que les autres resolvers. */
export async function resolveCalculableBlockOnPlayerBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_block_on_player")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_block_on_player", "is", null);
  const bets = (betsData ?? []) as EligibleBlockOnPlayerBetRow[];
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
    if (!bet.match_id || !bet.structured_block_on_player || !finishedMatchIds.has(bet.match_id)) {
      summary.skipped.push({ betId: bet.id, reason: bet.match_id && finishedMatchIds.has(bet.match_id) ? "contre structuré manquant" : "match pas encore terminé" });
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

    // Distingue "aucun événement synchronisé pour ce match" (jamais
    // tranché -- réessayé au prochain lancement) de "synchronisé mais 0
    // contre correspondant" (LOST, une vraie absence d'événement) : vérifie
    // d'abord qu'AU MOINS 1 ligne existe pour ce match, quel que soit le
    // bloqueur/victime (même geste que les autres resolvers -- jamais
    // trancher sur une absence totale de données synchronisées).
    const { count: matchEventCount } = await supabase
      .from("stats_block_events")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);
    if (matchEventCount === null) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const { blocker_player_id, victim_player_id } = bet.structured_block_on_player;
    const { count: matchCount } = await supabase
      .from("stats_block_events")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId)
      .eq("blocker_player_id", blocker_player_id)
      .eq("victim_player_id", victim_player_id);
    const won = (matchCount ?? 0) > 0;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: won
          ? "Résolu automatiquement -- ce contre a bien eu lieu durant le match."
          : "Résolu automatiquement -- ce contre n'a pas eu lieu durant le match.",
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
