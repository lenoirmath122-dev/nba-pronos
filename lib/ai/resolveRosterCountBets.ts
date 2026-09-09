import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, computeOutcome, resolveNbaGameId, ZERO_BOX_ROW } from "./resolveBetsShared";

// ============================================================================
// Chantier "comptage roster-wide" (étape 3 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md).
// ============================================================================

type StructuredRosterCount = {
  scope: "MATCH" | "team1" | "team2";
  pool: "ALL" | "STARTERS";
  count_relation: "AT_LEAST" | "MORE_THAN" | "FEWER_THAN";
  min_players: number;
  /** Bassin RÉEL résolu côté service au moment du calcul de proba (via
   *  _team_rotation()/_team_starters()) -- jamais recalculé ici, même leçon
   *  que structured_duel/structured_combo (structured_player_id) : la
   *  résolution doit voir EXACTEMENT le même bassin que la prédiction. */
  player_ids: number[];
};

type EligibleRosterCountBetRow = {
  id: string;
  match_id: string | null;
  structured_roster_count: StructuredRosterCount | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Résolution des paris ROSTER_COUNT -- lit stats_box_scores PAR
 *  player_id (pas par équipe comme ROSTER_SPLIT, le bassin peut couvrir les
 *  2 équipes à la fois), reconstitue le nombre réel de joueurs du bassin
 *  qui remplissent structured_stat/structured_threshold/structured_comparison
 *  (computeOutcome(), même helper que le reste de ce fichier) puis compare
 *  ce compte à min_players/count_relation. MATCH uniquement, même limite
 *  que les autres resolvers. */
export async function resolveCalculableRosterCountBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_roster_count, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_roster_count", "is", null);
  const bets = (betsData ?? []) as EligibleRosterCountBetRow[];
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
    if (!bet.match_id || !bet.structured_roster_count || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "comptage roster-wide structuré manquant" });
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

    const rc = bet.structured_roster_count;
    if (rc.player_ids.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "aucun joueur dans le bassin structuré" });
      continue;
    }

    // "Synchronisé ?" : au moins UNE ligne pour ce match, tout joueur/toute
    // équipe confondus (PAS filtré par player_ids -- un bassin de 10-30
    // joueurs peut légitimement compter des DNP réels, cf. ZERO_BOX_ROW
    // ci-dessus, donc un résultat vide filtré par player_ids ne prouve
    // rien sur l'état de la synchro).
    const { data: anyRows } = await supabase.from("stats_box_scores").select("player_id").eq("game_id", gameId).limit(1);
    if (!anyRows || anyRows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
      continue;
    }

    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("player_id, minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov")
      .eq("game_id", gameId)
      .in("player_id", rc.player_ids);
    const boxByPlayer = new Map(
      ((rows ?? []) as (BoxScoreRow & { player_id: number })[]).map((r) => [r.player_id, r])
    );

    const stat = bet.structured_stat as StatCode;
    let incomplete = false;
    let count = 0;
    for (const playerId of rc.player_ids) {
      const box = boxByPlayer.get(playerId) ?? ZERO_BOX_ROW;
      const satisfied = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, box);
      if (satisfied === null) {
        incomplete = true;
        break;
      }
      if (satisfied) count += 1;
    }
    if (incomplete) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant pour ce comptage roster-wide" });
      continue;
    }

    const won =
      rc.count_relation === "AT_LEAST" ? count >= rc.min_players
      : rc.count_relation === "MORE_THAN" ? count > rc.min_players
      : count < rc.min_players;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${count}/${rc.player_ids.length} joueurs du bassin remplissent la condition).`,
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
