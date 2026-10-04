import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { type ResolveBetsSummary, type SupabaseServiceClient, minutesToFloat, resolveNbaGameId, resolveNbaTeamId, isBoxScoreSynced, DNP_RESOLUTION_REASON } from "./resolveBetsShared";

type DuelOperandMeta = {
  kind: "PLAYER" | "TEAM";
  player_ids?: number[] | null;
  team_id?: string | null;
  stat: string;
};

type StructuredDuel = {
  left: DuelOperandMeta;
  right: DuelOperandMeta;
  relation: "GT" | "DIFF_LT" | "OR";
  multiplier: number;
};

type EligibleDuelBetRow = {
  id: string;
  match_id: string | null;
  structured_duel: StructuredDuel | null;
  structured_threshold: number | null;
};

/** Valeur réelle d'UN côté d'un duel pour le match résolu -- kind=PLAYER :
 *  somme la stat sur TOUS les player_ids de l'opérande (1 = joueur seul,
 *  2+ = cumul, même geste). kind=TEAM : même somme par team_id que
 *  resolveCalculableTeamStatBets() ci-dessus (team_id NBA résolu depuis
 *  l'uuid app via resolveNbaTeamId()). "min" à part (colonne `minutes`,
 *  format texte "12:34" -- minutesToFloat() comme le reste du fichier).
 *  null si les stats ne sont pas encore synchronisées pour ce match ;
 *  "DNP" si elles le sont mais qu'un joueur nommé de l'opérande n'a pas
 *  joué (p3-15, cf. isBoxScoreSynced()). */
async function resolveDuelOperandActual(
  supabase: SupabaseServiceClient, operand: DuelOperandMeta, gameId: string
): Promise<number | "DNP" | null> {
  // Cast vers une union de litéraux (pas `string` générique) -- necessaire
  // pour que le client Supabase typé résolve un vrai type de ligne au lieu
  // de GenericStringError sur un .select() dynamique (meme piège que
  // resolveCalculableTeamStatBets() ci-dessus, qui caste `stat` en
  // TeamStatCode pour la meme raison).
  const column = (operand.stat === "min" ? "minutes" : operand.stat) as
    | "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb" | "tov" | "minutes";

  if (operand.kind === "PLAYER") {
    const playerIds = operand.player_ids ?? [];
    if (playerIds.length === 0) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select(column)
      .eq("game_id", gameId)
      .in("player_id", playerIds);
    if (!rows || rows.length === 0) return (await isBoxScoreSynced(supabase, gameId)) ? "DNP" : null;
    if (rows.length < new Set(playerIds).size) return "DNP";
    return rows.reduce((sum, r) => {
      const raw = (r as Record<string, unknown>)[column];
      return sum + (operand.stat === "min" ? minutesToFloat(raw as string | null) : ((raw as number | null) ?? 0));
    }, 0);
  }

  const nbaTeamId = operand.team_id ? await resolveNbaTeamId(supabase, operand.team_id) : null;
  if (nbaTeamId === null) return null;
  const { data: rows } = await supabase
    .from("stats_box_scores")
    .select(column)
    .eq("game_id", gameId)
    .eq("team_id", nbaTeamId);
  if (!rows || rows.length === 0) return null;
  return rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[column]) ?? 0), 0);
}

/** Chantier comparaison/duel (24/08/2026, GAPS_OUVERTS.md) -- résolution
 *  des paris COMPARISON (2 côtés, structured_duel JSONB plutôt que
 *  structured_stat/structured_team_id -- cf. migration 20260824090000).
 *  Même limite MATCH uniquement que les autres resolvers de ce fichier.
 *  relation=GT : gagné si gauche > multiplier*droite. relation=DIFF_LT :
 *  gagné si |gauche-droite| < structured_threshold (égalité EXACTE au
 *  seuil traitée comme perdue, même convention que computeOutcome()
 *  ci-dessus). */
export async function resolveCalculableComparisonBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_duel, structured_threshold")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_duel", "is", null);
  const bets = (betsData ?? []) as EligibleDuelBetRow[];
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
    if (!bet.structured_duel) {
      summary.skipped.push({ betId: bet.id, reason: "duel structuré manquant" });
      continue;
    }
    const { left, right, relation, multiplier } = bet.structured_duel;
    if ((relation === "DIFF_LT" || relation === "OR") && bet.structured_threshold === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil manquant pour ce duel" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    const actualLeft = await resolveDuelOperandActual(supabase, left, gameId);
    const actualRight = await resolveDuelOperandActual(supabase, right, gameId);
    if (actualLeft === null || actualRight === null) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce duel" });
      continue;
    }

    // Joueur absent (p3-15) : en OU, seul son côté échoue, l'autre peut
    // encore faire gagner le pari ; en GT/DIFF_LT, la comparaison n'a pas
    // de sens sans lui -> perdu.
    const threshold = bet.structured_threshold as number;
    const hasDnp = actualLeft === "DNP" || actualRight === "DNP";
    const won =
      relation === "OR"
        ? (actualLeft !== "DNP" && actualLeft > threshold) || (actualRight !== "DNP" && actualRight > threshold)
        : actualLeft === "DNP" || actualRight === "DNP"
          ? false
          : relation === "GT"
            ? actualLeft > multiplier * actualRight
            : Math.abs(actualLeft - actualRight) < threshold;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const formatSide = (v: number | "DNP") => (v === "DNP" ? "n'a pas joué" : v.toFixed(1));

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason:
          hasDnp && !won
            ? DNP_RESOLUTION_REASON
            : `Résolu automatiquement via les statistiques officielles du match ` +
              `(gauche=${formatSide(actualLeft)}, droite=${formatSide(actualRight)}).`,
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
