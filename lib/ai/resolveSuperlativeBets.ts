import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, minutesToFloat, resolveNbaGameId, ZERO_BOX_ROW, COUNTING_STAT_COLUMN } from "./resolveBetsShared";

// ============================================================================
// Chantier "meilleur marqueur" / superlatif implicite (étape 4 du plan de
// reprise post-audit, 25/08/2026, GAPS_OUVERTS.md).
// ============================================================================

type StructuredSuperlative = { stat: string };

type EligibleSuperlativeBetRow = {
  id: string;
  match_id: string | null;
  structured_player_id: number | null;
  structured_superlative: StructuredSuperlative | null;
};

/** Valeur brute réelle d'une stat comptée pour 1 ligne de box score --
 *  même logique que la branche "comptée" de computeOutcome() (min à part,
 *  reste via COUNTING_STAT_COLUMN), extraite ici car le superlatif compare
 *  des VALEURS entre elles plutôt qu'une valeur à un seuil fixe. */
export function rawStatValue(stat: StatCode, box: BoxScoreRow): number {
  return stat === "min" ? minutesToFloat(box.minutes) : (box[COUNTING_STAT_COLUMN[stat]!] ?? 0);
}

/** Résolution des paris SUPERLATIVE -- "X marque plus de {stat} que TOUT
 *  AUTRE joueur du match" (cf. structureSuperlativeBet.ts). Contrairement
 *  aux autres resolvers de ce fichier, lit TOUS les joueurs du match (les
 *  2 équipes, sans filtre team_id/player_ids -- l'ensemble de comparaison
 *  N'EST PAS un bassin pré-résolu comme ROSTER_COUNT, c'est litéralement
 *  "tout le monde qui a une ligne réelle dans ce match"), donc PAS besoin
 *  de persister un bassin de player_ids ici (structured_player_id suffit à
 *  identifier le joueur visé, structured_superlative ne porte que `stat`).
 *  Un joueur absent du box score (DNP) est traité comme une ligne à 0 --
 *  même convention que ZERO_BOX_ROW (ROSTER_COUNT) -- que ce soit le joueur
 *  visé (perd quasi certainement) ou un autre (ne compte simplement pas
 *  comme un concurrent réel, ce qui est déjà le comportement naturel en ne
 *  l'incluant pas dans boxRows). MATCH uniquement, même limite que les
 *  autres resolvers. */
export async function resolveCalculableSuperlativeBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_player_id, structured_superlative")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_superlative", "is", null);
  const bets = (betsData ?? []) as EligibleSuperlativeBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const matchById = new Map(((matchesData ?? []) as { id: string; status: string }[]).map((m) => [m.id, m]));

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
    if (!bet.match_id || !bet.structured_superlative || bet.structured_player_id === null) {
      summary.skipped.push({ betId: bet.id, reason: "superlatif structuré manquant" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    const match = matchById.get(bet.match_id);
    if (!match || match.status !== "FINISHED") {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("player_id, minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, tov")
      .eq("game_id", gameId);
    if (!rows || rows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const stat = bet.structured_superlative.stat as StatCode;
    const boxRows = rows as (BoxScoreRow & { player_id: number })[];
    const playerBox = boxRows.find((r) => r.player_id === bet.structured_player_id);
    const playerValue = rawStatValue(stat, playerBox ?? ZERO_BOX_ROW);

    // Gagné si CHAQUE autre joueur du match a une valeur STRICTEMENT
    // inférieure (égalité = perdu, même convention que computeOutcome()).
    const won = boxRows
      .filter((r) => r.player_id !== bet.structured_player_id)
      .every((r) => rawStatValue(stat, r) < playerValue);
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${playerValue} vs le reste du match).`,
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
