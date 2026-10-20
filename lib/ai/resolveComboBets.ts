import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { COMBO_WIN_STAT, COMBO_MARGIN_STAT, COMBO_STARTER_STAT, COMBO_QUARTERS_WON_STAT, periodOfComboWinStat } from "./teamStatCodes";
import { computePeriodTeamOutcome, type MatchPeriodRow } from "./resolvePeriodBets";
import { type ResolveBetsSummary, type BoxScoreRow, type SupabaseServiceClient, rowStatValue, computeOutcome, resolveNbaGameId, resolveNbaTeamId, isBoxScoreSynced } from "./resolveBetsShared";

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

/** Valeur réelle (true/false/null) d'UNE condition combo pour le match
 *  résolu (24/08/2026, GAPS_OUVERTS.md, chantier combo). 2 chemins, MÊME
 *  dispatch que _condition_proba() côté service (supabase_context.py) :
 *  - SIMPLE (1 entité, 1 stat) : réutilise TEL QUEL computeOutcome() --
 *    couverture complète (dd/td, pourcentages, comptées), déjà éprouvée
 *    pour les paris PLAYER classiques.
 *  - SOMME (plusieurs entités et/ou plusieurs stats) : additionne les
 *    valeurs brutes (stats comptées uniquement, déjà garanti côté
 *    structuration -- structureAndScoreBet.ts/supabase_context.py).
 *  null si les stats ne sont pas encore synchronisées pour ce match ;
 *  false si elles le sont mais qu'un joueur nommé n'a pas joué (p3-15,
 *  cf. isBoxScoreSynced()). */
async function resolveComboConditionSatisfied(
  supabase: SupabaseServiceClient, condition: ComboConditionRow, gameId: string, matchId: string
): Promise<boolean | null> {
  // Vainqueur du match (S4) : lit le score final de matches, pas le box score.
  const isMargin = condition.kind === "TEAM" && condition.stats.length === 1 && condition.stats[0] === COMBO_MARGIN_STAT;
  if (condition.kind === "TEAM" && condition.stats.length === 1 && (condition.stats[0] === COMBO_WIN_STAT || isMargin)) {
    const { data: match } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, home_score, away_score")
      .eq("id", matchId)
      .maybeSingle<{ home_team_id: string | null; away_team_id: string | null; home_score: number | null; away_score: number | null }>();
    if (!match || match.home_score === null || match.away_score === null) return null;
    const isHome = condition.team_id === match.home_team_id;
    if (!isHome && condition.team_id !== match.away_team_id) return null;
    if (isMargin) {
      if (condition.threshold === null) return null;
      const margin = isHome ? match.home_score - match.away_score : match.away_score - match.home_score;
      return condition.comparison === "UNDER" ? margin < condition.threshold : margin > condition.threshold;
    }
    const wins = isHome ? match.home_score > match.away_score : match.away_score > match.home_score;
    return condition.comparison === "UNDER" ? !wins : wins;
  }
  // Période d'équipe (S4 fin) : quarts-temps remportés / remporte une période,
  // lus dans matches.quarter_scores comme le pari période.
  if (condition.kind === "TEAM" && condition.stats.length === 1) {
    const stat = condition.stats[0];
    const period = periodOfComboWinStat(stat);
    if (stat === COMBO_QUARTERS_WON_STAT || period) {
      const { data: match } = await supabase
        .from("matches")
        .select("id, status, home_team_id, away_team_id, home_score, away_score, quarter_scores")
        .eq("id", matchId)
        .maybeSingle<MatchPeriodRow>();
      if (!match || !match.quarter_scores) return null;
      const isHome = condition.team_id === match.home_team_id;
      if (!isHome && condition.team_id !== match.away_team_id) return null;
      const outcome = period
        ? computePeriodTeamOutcome(period.startsWith("Q") ? "QUARTER_WINNER" : "HALF_WINNER", period, isHome, null, null, null, match)
        : computePeriodTeamOutcome("QUARTERS_WON_COUNT", null, isHome, false, condition.threshold, condition.comparison, match);
      if (!outcome) return null;
      return period && condition.comparison === "UNDER" ? !outcome.won : outcome.won;
    }
  }
  const isSimple = condition.kind === "TEAM"
    ? condition.stats.length === 1
    : condition.stats.length === 1 && (condition.player_ids?.length ?? 0) === 1;

  if (condition.kind === "PLAYER" && isSimple) {
    const playerId = condition.player_ids?.[0];
    if (!playerId) return null;
    // Titulaire ou remplaçant (S8) : position non vide = titulaire. Pas de
    // ligne = le joueur n'a pas joué (condition fausse) ou box score pas encore importé.
    if (condition.stats[0] === COMBO_STARTER_STAT) {
      const { data: startRows } = await supabase
        .from("stats_box_scores")
        .select("position")
        .eq("game_id", gameId)
        .eq("player_id", playerId);
      if (!startRows || startRows.length === 0) return (await isBoxScoreSynced(supabase, gameId)) ? false : null;
      const started = Boolean((startRows[0] as { position: string | null }).position);
      return condition.comparison === "UNDER" ? !started : started;
    }
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov, pf")
      .eq("game_id", gameId)
      .eq("player_id", playerId);
    if (!rows || rows.length === 0) return (await isBoxScoreSynced(supabase, gameId)) ? false : null;
    return computeOutcome(condition.stats[0] as StatCode, condition.threshold, condition.comparison, rows[0] as BoxScoreRow);
  }

  let total = 0;
  if (condition.kind === "PLAYER") {
    const playerIds = condition.player_ids ?? [];
    if (playerIds.length === 0) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, tov, pf")
      .eq("game_id", gameId)
      .in("player_id", playerIds);
    if (!rows || rows.length === 0) return (await isBoxScoreSynced(supabase, gameId)) ? false : null;
    // Box score importé (au moins un des joueurs a une ligne) mais un
    // joueur nommé manque : il n'a pas joué, la condition est fausse
    // (p3-15) -- avant, sa part comptait silencieusement pour 0.
    if (rows.length < new Set(playerIds).size) return false;
    for (const r of rows as Record<string, unknown>[]) {
      for (const s of condition.stats) total += rowStatValue(s, r);
    }
  } else {
    const nbaTeamId = condition.team_id ? await resolveNbaTeamId(supabase, condition.team_id) : null;
    if (nbaTeamId === null) return null;
    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, tov, pf")
      .eq("game_id", gameId)
      .eq("team_id", nbaTeamId);
    if (!rows || rows.length === 0) return null;
    for (const r of rows as Record<string, unknown>[]) {
      for (const s of condition.stats) total += rowStatValue(s, r);
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
  supabase: SupabaseServiceClient, group: ComboConditionGroup, gameId: string, matchId: string
): Promise<boolean | null> {
  let sawIncomplete = false;
  for (const condition of group.or) {
    const satisfied = await resolveComboConditionSatisfied(supabase, condition, gameId, matchId);
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
      const satisfied = await resolveComboGroupSatisfied(supabase, group, gameId, bet.match_id);
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

