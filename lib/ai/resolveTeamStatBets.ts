import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { TEAM_STAT_CODES, TEAM_PERCENTAGE_STATS, type TeamStatCode } from "./teamStatCodes";
import { type ResolveBetsSummary, resolveNbaGameId, resolveNbaTeamId } from "./resolveBetsShared";

type EligibleTeamStatBetRow = {
  id: string;
  match_id: string | null;
  structured_stat: string | null; // "{stat}" (TEAM_STAT, vise structured_team_id) ou "total_{stat}" (MATCH_TOTAL, combiné)
  structured_team_id: string | null; // non-null uniquement pour la forme "{stat}"
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

// Libellés FR pour le message de résolution (23/08/2026, piece (a) suite --
// reb fait 1er en pilote, ast/fg3m/stl/blk généralisés dans la foulée, même
// geste). Distinct de teamStatCodes.ts::TEAM_STAT_LABELS_FR (celui-ci
// contient déjà "de l'équipe", pas adapté à "X {label} du match").
const TEAM_STAT_RESOLUTION_LABELS_FR: Record<TeamStatCode, string> = {
  pts: "points", reb: "rebonds", ast: "passes décisives", fg3m: "3-points réussis", stl: "interceptions", blk: "contres",
  oreb: "rebonds offensifs", ft: "% aux lancers francs", fg: "% au tir", fg3: "% à 3-points", fga: "tirs tentés",
  tov: "pertes de balle",
};

// Chantier "% tir équipe" (24/08/2026, GAPS_OUVERTS.md) -- ft/fg/fg3 n'ont
// PAS de colonne pré-calculée dans stats_box_scores (contrairement aux
// autres TEAM_STAT_CODES, sommables directement) : besoin de sommer les 2
// colonnes brutes réussites/tentatives sur tous les joueurs de l'équipe
// pour CE match, puis calculer le ratio -- même principe que
// PCT_MAKES_ATTEMPTS_COLUMNS (résolution JOUEUR, plus haut dans ce fichier),
// agrégé équipe entière au lieu d'un seul joueur.
const TEAM_PCT_MAKES_ATTEMPTS_COLUMNS: Record<"ft" | "fg" | "fg3", readonly [string, string]> = {
  ft: ["ftm", "fta"],
  fg: ["fgm", "fga"],
  fg3: ["fg3m", "fg3a"],
};

/** Pièce (a) du chantier paris équipe, suite (GAPS_OUVERTS.md, 23/08/2026)
 *  -- résolution des paris stat équipe (les 2 formes, pour reb/ast/fg3m/stl/
 *  blk : TEAM_STAT "{stat}" pour une équipe précise, MATCH_TOTAL "total_{stat}"
 *  combiné -- reb fait 1er en pilote, généralisé aux 4 autres dans la foulée,
 *  même geste). Contrairement à resolveCalculableMatchTotalBets()
 *  (total_points, direct via matches.home_score/away_score) : ces stats
 *  n'existent PAS sur `matches`, seulement dans stats_box_scores (pipeline
 *  Data NBA) -- réutilise resolveNbaGameId() (déjà éprouvée côté joueur) +
 *  une nouvelle résolution d'équipe NBA (resolveNbaTeamId(), même
 *  rapprochement par tricode) pour filtrer/sommer les vraies stats. MATCH
 *  uniquement (même limite que la prédiction). */
export async function resolveCalculableTeamStatBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const eligibleStats = TEAM_STAT_CODES.flatMap((stat) => [stat, `total_${stat}`]);
  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_stat, structured_team_id, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .in("structured_stat", eligibleStats);
  const bets = (betsData ?? []) as EligibleTeamStatBetRow[];
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
    if (bet.structured_threshold === null || !bet.structured_comparison) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }
    const isTotal = bet.structured_stat?.startsWith("total_") ?? false;
    const stat = (isTotal ? bet.structured_stat?.slice("total_".length) : bet.structured_stat) as TeamStatCode;
    if (!isTotal && !bet.structured_team_id) {
      summary.skipped.push({ betId: bet.id, reason: "équipe manquante" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    // ft/fg/fg3 n'existent QUE sous la forme "équipe précise" (pas de
    // modèle/mécanisme "total_" pour un pourcentage combiné, décidé au
    // cadrage du chantier "% tir équipe") -- jamais produit par
    // structureAndScoreBet.ts, mais garde explicite ici plutôt qu'un calcul
    // silencieusement faux si ce cas apparaissait un jour.
    if (isTotal && TEAM_PERCENTAGE_STATS.has(stat)) {
      summary.skipped.push({ betId: bet.id, reason: "forme combinée non supportée pour un pourcentage" });
      continue;
    }

    let actualStat: number;
    if (isTotal) {
      const { data: rows } = await supabase.from("stats_box_scores").select(stat).eq("game_id", gameId);
      if (!rows || rows.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
        continue;
      }
      actualStat = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[stat]) ?? 0), 0);
    } else {
      const nbaTeamId = await resolveNbaTeamId(supabase, bet.structured_team_id as string);
      if (nbaTeamId === null) {
        summary.skipped.push({ betId: bet.id, reason: "équipe NBA correspondante introuvable" });
        continue;
      }
      if (TEAM_PERCENTAGE_STATS.has(stat)) {
        const [makesCol, attemptsCol] = TEAM_PCT_MAKES_ATTEMPTS_COLUMNS[stat as "ft" | "fg" | "fg3"];
        // Selection LITTERALE fixe (les 6 colonnes des 3 stats de %), pas un
        // template dynamique -- le typage genere de @supabase/supabase-js
        // pour .select() analyse la chaine litteralement, un template
        // `${a}, ${b}` casse ce typage (TS2352).
        const { data: rows } = await supabase
          .from("stats_box_scores")
          .select("ftm, fta, fgm, fga, fg3m, fg3a")
          .eq("game_id", gameId)
          .eq("team_id", nbaTeamId);
        if (!rows || rows.length === 0) {
          summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour cette équipe" });
          continue;
        }
        const totalMakes = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[makesCol]) ?? 0), 0);
        const totalAttempts = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[attemptsCol]) ?? 0), 0);
        actualStat = totalAttempts > 0 ? totalMakes / totalAttempts : 0;
      } else {
        const { data: rows } = await supabase
          .from("stats_box_scores")
          .select(stat)
          .eq("game_id", gameId)
          .eq("team_id", nbaTeamId);
        if (!rows || rows.length === 0) {
          summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour cette équipe" });
          continue;
        }
        actualStat = rows.reduce((sum, r) => sum + (((r as Record<string, number | null>)[stat]) ?? 0), 0);
      }
    }

    const won =
      bet.structured_comparison === "UNDER" ? actualStat < bet.structured_threshold : actualStat > bet.structured_threshold;
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const actualStatLabel = TEAM_PERCENTAGE_STATS.has(stat) ? `${Math.round(actualStat * 100)}%` : actualStat;

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason:
          `Résolu automatiquement via les statistiques officielles du match ` +
          `(${actualStatLabel} ${TEAM_STAT_RESOLUTION_LABELS_FR[stat]}).`,
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
