import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, type SupabaseServiceClient, minutesToFloat, computeOutcome, resolveNbaGameId, resolveNbaTeamId } from "./resolveBetsShared";

type ComboConditionRow = {
  kind: "PLAYER" | "TEAM";
  player_ids: number[] | null;
  team_id: string | null;
  stats: string[];
  threshold: number | null;
  comparison: "OVER" | "UNDER";
};

type ComboConditionGroup = { or: ComboConditionRow[] };

type StructuredCombo = { conditions: ComboConditionGroup[] };

type EligibleComboBetRow = {
  id: string;
  match_id: string | null;
  structured_combo: StructuredCombo | null;
};

// Colonnes comptees potentiellement sommees dans une condition combo
// "somme" (2+ joueurs et/ou 2+ stats) -- meme restriction que cote
// service (supabase_context.py::_condition_proba, REGRESSION_STATS) : pas
// de dd/td/pourcentage, qui n'ont pas de valeur numerique directe a
// sommer.
type ComboSumColumn = "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk" | "fga" | "fg3a" | "oreb" | "plus_minus" | "tov";

/** Valeur réelle (true/false/null) d'UNE condition combo pour le match
 *  résolu (24/08/2026, GAPS_OUVERTS.md, chantier combo). 2 chemins, MÊME
 *  dispatch que _condition_proba() côté service (supabase_context.py) :
 *  - SIMPLE (1 entité, 1 stat) : réutilise TEL QUEL computeOutcome() --
 *    couverture complète (dd/td, pourcentages, comptées), déjà éprouvée
 *    pour les paris PLAYER classiques.
 *  - SOMME (plusieurs entités et/ou plusieurs stats) : additionne les
 *    valeurs brutes (stats comptées uniquement, déjà garanti côté
 *    structuration -- structureAndScoreBet.ts/supabase_context.py).
 *  null si les stats ne sont pas encore synchronisées pour ce match. */
async function resolveComboConditionSatisfied(
  supabase: SupabaseServiceClient, condition: ComboConditionRow, gameId: string
): Promise<boolean | null> {
  const isSimple = condition.kind === "TEAM"
    ? condition.stats.length === 1
    : condition.stats.length === 1 && (condition.player_ids?.length ?? 0) === 1;

  if (condition.kind === "PLAYER" && isSimple) {
    const playerId = condition.player_ids?.[0];
    if (!playerId) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov")
      .eq("game_id", gameId)
      .eq("player_id", playerId);
    if (!rows || rows.length === 0) return null;
    return computeOutcome(condition.stats[0] as StatCode, condition.threshold, condition.comparison, rows[0] as BoxScoreRow);
  }

  let total = 0;
  if (condition.kind === "PLAYER") {
    const playerIds = condition.player_ids ?? [];
    if (playerIds.length === 0) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb, plus_minus, tov")
      .eq("game_id", gameId)
      .in("player_id", playerIds);
    if (!rows || rows.length === 0) return null;
    for (const r of rows as (Pick<BoxScoreRow, "minutes"> & Record<ComboSumColumn, number | null>)[]) {
      for (const s of condition.stats) {
        total += s === "min" ? minutesToFloat(r.minutes) : (r[s as ComboSumColumn] ?? 0);
      }
    }
  } else {
    const nbaTeamId = condition.team_id ? await resolveNbaTeamId(supabase, condition.team_id) : null;
    if (nbaTeamId === null) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("pts, reb, ast, fg3m, stl, blk, fga, fg3a, oreb, plus_minus, tov")
      .eq("game_id", gameId)
      .eq("team_id", nbaTeamId);
    if (!rows || rows.length === 0) return null;
    for (const r of rows as Record<ComboSumColumn, number | null>[]) {
      for (const s of condition.stats) {
        total += r[s as ComboSumColumn] ?? 0;
      }
    }
  }
  if (condition.threshold === null) return null;
  return condition.comparison === "UNDER" ? total < condition.threshold : total > condition.threshold;
}

/** Valeur réelle (true/false/null) d'UN GROUPE combo -- étape 7 du plan de
 *  reprise post-audit (25/08/2026, GAPS_OUVERTS.md, "OU imbriqué dans un
 *  ET"). 1 seule condition dans le groupe : comportement INCHANGÉ (délègue
 *  directement à resolveComboConditionSatisfied()). 2+ conditions : le
 *  groupe est VRAI dès qu'UNE SEULE condition l'est (court-circuite sur le
 *  premier true trouvé, même esprit que le court-circuit du ET global sur
 *  le premier false) -- NULL (données pas encore synchronisées) seulement
 *  si AUCUNE condition n'est trouvée vraie ET qu'au moins une reste
 *  incomplète (une donnée manquante ne peut jamais, à elle seule, faire
 *  perdre un groupe OU si une autre condition du même groupe est déjà
 *  confirmée vraie). */
async function resolveComboGroupSatisfied(
  supabase: SupabaseServiceClient, group: ComboConditionGroup, gameId: string
): Promise<boolean | null> {
  let sawIncomplete = false;
  for (const condition of group.or) {
    const satisfied = await resolveComboConditionSatisfied(supabase, condition, gameId);
    if (satisfied === true) return true;
    if (satisfied === null) sawIncomplete = true;
  }
  return sawIncomplete ? null : false;
}

/** Chantier combo (24/08/2026, GAPS_OUVERTS.md ; étendu étape 7,
 *  25/08/2026, "OU imbriqué dans un ET") -- résolution des paris COMBO (ET
 *  de N GROUPES, structured_combo JSONB -- même colonne que le chantier
 *  d'origine, migration 20260824100000, juste une forme imbriquée en plus
 *  à l'intérieur -- aucune nouvelle migration nécessaire). Même limite
 *  MATCH uniquement que les autres resolvers. Court-circuite dès le 1er
 *  GROUPE FAUX (le combo est perdu, peu importe
 *  que les groupes suivants aient des stats synchronisées ou non) --
 *  résout les paris perdus plus vite sans attendre des données qui ne
 *  changeront pas l'issue. */
export async function resolveCalculableComboBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_combo")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_combo", "is", null);
  const bets = (betsData ?? []) as EligibleComboBetRow[];
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
    if (!bet.structured_combo || bet.structured_combo.conditions.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "combo structuré manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    let allSatisfied = true;
    let incomplete = false;
    for (const group of bet.structured_combo.conditions) {
      const satisfied = await resolveComboGroupSatisfied(supabase, group, gameId);
      if (satisfied === null) {
        incomplete = true;
        break;
      }
      if (!satisfied) {
        allSatisfied = false;
        break;
      }
    }
    if (incomplete) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce combo" });
      continue;
    }

    const outcome: "WON" | "LOST" = allSatisfied ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${bet.structured_combo.conditions.length} groupes).`,
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

