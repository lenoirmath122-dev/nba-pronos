import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { TEAM_TARGETED_PERIOD_OUTCOMES, PERIOD_LABELS_FR, type PeriodCode, type PeriodOutcomeKind } from "./periodStatCodes";
import { type ResolveBetsSummary, type BoxScoreRow, computeOutcome, resolveNbaGameId } from "./resolveBetsShared";

export type QuarterScores = { homeTeam: number[]; awayTeam: number[] };

export type MatchPeriodRow = {
  id: string;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  quarter_scores: QuarterScores | null;
};

// ============================================================================
// Chantier "pari période" équipe + joueur (GAPS_OUVERTS.md, 24/08/2026).
// ============================================================================

type StructuredPeriod = {
  period: PeriodCode | null;
  outcome_kind: PeriodOutcomeKind | null;
  team_id: string | null;
  player_id: number | null;
  exact_count: boolean | null;
};

type EligiblePeriodBetRow = {
  id: string;
  match_id: string | null;
  structured_period: StructuredPeriod | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

/** Indices 0-based de matches.quarter_scores.{homeTeam,awayTeam} couverts
 *  par une période -- Q1-Q4 = 1 quart-temps, H1/H2 = 2 quarts-temps
 *  (mi-temps). Jamais appelée pour QUARTERS_WON_COUNT (period=null, lit les
 *  4 quarts-temps directement -- voir plus bas). */
export function periodQuarterIndices(period: PeriodCode): number[] {
  switch (period) {
    case "Q1": return [0];
    case "Q2": return [1];
    case "Q3": return [2];
    case "Q4": return [3];
    case "H1": return [0, 1];
    case "H2": return [2, 3];
  }
}

export function sumQuarterRange(scores: number[], indices: number[]): number {
  return indices.reduce((sum, i) => sum + (scores[i] ?? 0), 0);
}

/** Indices CUMULATIFS depuis le début du match jusqu'à la fin de la période
 *  donnée -- distinct de periodQuarterIndices() (segment de cette seule
 *  période). Utilisé UNIQUEMENT pour MARGIN : "l'écart à la fin du 3e
 *  quart-temps" désigne l'écart de score cumulé Q1+Q2+Q3, pas l'écart du
 *  seul 3e quart-temps (bug réel trouvé en cadrant, avant de coder les
 *  modèles Python -- corrigé ici et dans build_targets.py/supabase_context.py
 *  pour rester cohérent). TOTAL_POINTS reste un segment (periodQuarterIndices)
 *  -- "le total du 4e quart-temps" désigne bien les points marqués PENDANT
 *  cette période, pas le score cumulé. */
export function cumulativeQuarterIndices(period: PeriodCode): number[] {
  switch (period) {
    case "Q1": return [0];
    case "Q2": return [0, 1];
    case "Q3": return [0, 1, 2];
    case "Q4": return [0, 1, 2, 3];
    case "H1": return [0, 1];
    case "H2": return [0, 1, 2, 3];
  }
}

/** Résultat ÉQUIPE réel pour un outcome_kind donné -- null si donnée
 *  insuffisante pour trancher (même convention que computeOutcome()
 *  ci-dessus, jamais résolu dans ce cas). `teamIsHome` : le côté visé par le
 *  pari (team_id résolu) est-il l'équipe DOMICILE de ce match -- null pour
 *  les outcome_kind symétriques (MARGIN/TOTAL_POINTS). */
export function computePeriodTeamOutcome(
  outcomeKind: PeriodOutcomeKind,
  period: PeriodCode | null,
  teamIsHome: boolean | null,
  exactCount: boolean | null,
  threshold: number | null,
  comparison: "OVER" | "UNDER" | null,
  match: MatchPeriodRow
): { won: boolean; detail: string } | null {
  const qs = match.quarter_scores;
  if (!qs) return null;

  if (outcomeKind === "QUARTERS_WON_COUNT") {
    if (teamIsHome === null || threshold === null) return null;
    let wonCount = 0;
    for (let i = 0; i < 4; i++) {
      const home = qs.homeTeam[i] ?? 0;
      const away = qs.awayTeam[i] ?? 0;
      const teamScore = teamIsHome ? home : away;
      const oppScore = teamIsHome ? away : home;
      if (teamScore > oppScore) wonCount++;
    }
    const won = exactCount ? wonCount === threshold : comparison === "UNDER" ? wonCount < threshold : wonCount > threshold;
    return { won, detail: `${wonCount} quart(s)-temps remporté(s)` };
  }

  if (outcomeKind === "LEADS_HALF_RESULT") {
    if (teamIsHome === null || match.home_score === null || match.away_score === null) return null;
    const indices = periodQuarterIndices("H1");
    const homeHalf = sumQuarterRange(qs.homeTeam, indices);
    const awayHalf = sumQuarterRange(qs.awayTeam, indices);
    const teamLeadsAtHalf = teamIsHome ? homeHalf > awayHalf : awayHalf > homeHalf;
    if (!teamLeadsAtHalf) {
      // L'équipe visée ne mène même pas à la mi-temps -- le pari (qui
      // affirme qu'elle mène ET gagne/perd) est faux quel que soit le
      // résultat final, même mi-temps nulle traitée comme "ne mène pas".
      return { won: false, detail: `ne mène pas à la mi-temps (${homeHalf}-${awayHalf})` };
    }
    const teamWinsMatch = teamIsHome ? match.home_score > match.away_score : match.away_score > match.home_score;
    // comparison=OVER : le pari affirme que l'équipe qui mène GAGNE le match.
    // comparison=UNDER : le pari affirme qu'elle PERD (mène puis perd).
    const won = comparison === "UNDER" ? !teamWinsMatch : teamWinsMatch;
    return { won, detail: `mène à la mi-temps (${homeHalf}-${awayHalf}), ${teamWinsMatch ? "gagne" : "perd"} le match` };
  }

  if (outcomeKind === "MARGIN" || outcomeKind === "TOTAL_POINTS") {
    if (!period || threshold === null || !comparison) return null;
    // MARGIN = écart CUMULATIF depuis le début du match (cumulativeQuarterIndices).
    // TOTAL_POINTS = points marqués PENDANT cette période uniquement (segment).
    const indices = outcomeKind === "MARGIN" ? cumulativeQuarterIndices(period) : periodQuarterIndices(period);
    const homeSum = sumQuarterRange(qs.homeTeam, indices);
    const awaySum = sumQuarterRange(qs.awayTeam, indices);
    const actual = outcomeKind === "MARGIN" ? Math.abs(homeSum - awaySum) : homeSum + awaySum;
    const won = comparison === "UNDER" ? actual < threshold : actual > threshold;
    return { won, detail: `${actual} (${outcomeKind === "MARGIN" ? "écart cumulé" : "total combiné"})` };
  }

  if (!period) return null;
  const indices = periodQuarterIndices(period);
  const homeSum = sumQuarterRange(qs.homeTeam, indices);
  const awaySum = sumQuarterRange(qs.awayTeam, indices);

  if (outcomeKind === "QUARTER_WINNER" || outcomeKind === "HALF_WINNER") {
    if (teamIsHome === null) return null;
    const teamSum = teamIsHome ? homeSum : awaySum;
    const oppSum = teamIsHome ? awaySum : homeSum;
    return { won: teamSum > oppSum, detail: `${homeSum}-${awaySum} sur cette période` };
  }

  if (outcomeKind === "POINT_SHARE_PCT") {
    if (teamIsHome === null || threshold === null || !comparison || match.home_score === null || match.away_score === null) return null;
    const periodSum = teamIsHome ? homeSum : awaySum;
    const gameTotal = teamIsHome ? match.home_score : match.away_score;
    if (gameTotal === 0) return null;
    const actualPct = periodSum / gameTotal;
    const won = comparison === "UNDER" ? actualPct < threshold : actualPct > threshold;
    return { won, detail: `${(actualPct * 100).toFixed(0)}% des points sur cette période` };
  }

  return null;
}

/** Chantier "pari période" équipe (GAPS_OUVERTS.md, 24/08/2026) -- résolution
 *  des paris PERIOD, 2 formes distinguées par structured_period.player_id :
 *  ÉQUIPE (lit matches.quarter_scores DIRECTEMENT, même patron que
 *  resolveCalculableMatchTotalBets() -- aucune dépendance à
 *  stats_box_scores) ou JOUEUR (lit stats_box_scores_by_period, nouvelle
 *  table du chantier joueur+période construit le même jour -- réutilise
 *  computeOutcome()/COUNTING_STAT_COLUMN/PCT_MAKES_ATTEMPTS_COLUMNS déjà
 *  définis plus haut, colonnes identiques à stats_box_scores). MATCH
 *  uniquement, même limite que les autres resolvers de ce fichier. */
export async function resolveCalculablePeriodBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_period, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_period", "is", null);
  const bets = (betsData ?? []) as EligiblePeriodBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, status, home_team_id, away_team_id, home_score, away_score, quarter_scores")
    .in("id", matchIds);
  const matchById = new Map(((matchesData ?? []) as MatchPeriodRow[]).map((m) => [m.id, m]));

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
    if (!bet.match_id || !bet.structured_period) {
      summary.skipped.push({ betId: bet.id, reason: "période structurée manquante" });
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

    const sp = bet.structured_period;

    // ---- Forme JOUEUR ----
    if (sp.player_id !== null) {
      const stat = bet.structured_stat as StatCode | null;
      if (!stat || !sp.period) {
        summary.skipped.push({ betId: bet.id, reason: "stat/période joueur manquante" });
        continue;
      }
      const gameId = await resolveNbaGameId(supabase, bet.match_id);
      if (!gameId) {
        summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
        continue;
      }
      const dbPeriods = periodQuarterIndices(sp.period).map((i) => i + 1); // 0-based -> 1-4 stocké en base
      const { data: rows } = await supabase
        .from("stats_box_scores_by_period")
        .select("pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, minutes")
        .eq("game_id", gameId)
        .eq("player_id", sp.player_id)
        .in("period", dbPeriods);
      if (!rows || rows.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats par période synchronisées pour ce joueur" });
        continue;
      }
      const box: BoxScoreRow = {
        minutes: rows.reduce((sum, r) => sum + ((r.minutes as number | null) ?? 0), 0).toString(),
        pts: rows.reduce((sum, r) => sum + ((r.pts as number | null) ?? 0), 0),
        reb: rows.reduce((sum, r) => sum + ((r.reb as number | null) ?? 0), 0),
        ast: rows.reduce((sum, r) => sum + ((r.ast as number | null) ?? 0), 0),
        fg3m: rows.reduce((sum, r) => sum + ((r.fg3m as number | null) ?? 0), 0),
        stl: rows.reduce((sum, r) => sum + ((r.stl as number | null) ?? 0), 0),
        blk: rows.reduce((sum, r) => sum + ((r.blk as number | null) ?? 0), 0),
        ftm: rows.reduce((sum, r) => sum + ((r.ftm as number | null) ?? 0), 0),
        fta: rows.reduce((sum, r) => sum + ((r.fta as number | null) ?? 0), 0),
        fgm: rows.reduce((sum, r) => sum + ((r.fgm as number | null) ?? 0), 0),
        fga: rows.reduce((sum, r) => sum + ((r.fga as number | null) ?? 0), 0),
        fg3a: rows.reduce((sum, r) => sum + ((r.fg3a as number | null) ?? 0), 0),
        oreb: rows.reduce((sum, r) => sum + ((r.oreb as number | null) ?? 0), 0),
        // stats_box_scores_by_period n'a PAS de colonne plus_minus (cf.
        // migration 20260824150000) -- un pari joueur+période sur cette
        // stat resterait donc structurable (plus_minus est dans
        // REGRESSION_STATS côté service) mais mal résolu ici (toujours 0).
        // Gap réel découvert le 25/08/2026 (étape 4) en généralisant
        // COUNTING_STAT_COLUMN, noté dans GAPS_OUVERTS.md -- pas corrigé
        // maintenant (demande un nouveau backfill, hors périmètre de ce
        // chantier).
        plus_minus: null,
        // Même limite pour technical_fouls (étape 5, GAPS_OUVERTS.md) --
        // "tech" n'a de toute façon pas de sens à l'échelle d'une seule
        // période (probabilité directe "au moins 1 sur le match entier").
        technical_fouls: null,
        // Même limite pour tov (06/09/2026) -- stats_box_scores_by_period
        // n'a pas non plus de colonne tov, volontairement laissé hors
        // scope de ce chantier (pas de preuve d'usage réel à l'échelle
        // période, demanderait une 2e migration).
        tov: null,
      };
      const won = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, box);
      if (won === null) {
        summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant pour ce pari joueur+période" });
        continue;
      }
      const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
      const { data: updated } = await supabase
        .from("bets")
        .update({
          status: outcome,
          resolution_reason: `Résolu automatiquement via les statistiques officielles du match, ${PERIOD_LABELS_FR[sp.period]}.`,
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
      continue;
    }

    // ---- Forme ÉQUIPE ----
    if (!sp.outcome_kind) {
      summary.skipped.push({ betId: bet.id, reason: "outcome_kind manquant" });
      continue;
    }
    let teamIsHome: boolean | null = null;
    if (TEAM_TARGETED_PERIOD_OUTCOMES.has(sp.outcome_kind)) {
      if (!sp.team_id || !match.home_team_id || !match.away_team_id) {
        summary.skipped.push({ betId: bet.id, reason: "équipe visée manquante" });
        continue;
      }
      if (sp.team_id !== match.home_team_id && sp.team_id !== match.away_team_id) {
        summary.skipped.push({ betId: bet.id, reason: "équipe visée hors de ce match" });
        continue;
      }
      teamIsHome = sp.team_id === match.home_team_id;
    }

    const result = computePeriodTeamOutcome(
      sp.outcome_kind,
      sp.period,
      teamIsHome,
      sp.exact_count,
      bet.structured_threshold,
      bet.structured_comparison,
      match
    );
    if (!result) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de score par quart-temps synchronisé pour ce match" });
      continue;
    }
    const outcome: "WON" | "LOST" = result.won ? "WON" : "LOST";

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${result.detail}).`,
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
