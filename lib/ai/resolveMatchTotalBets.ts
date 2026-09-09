import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { ResolveBetsSummary } from "./resolveBetsShared";

type EligibleMatchTotalBetRow = {
  id: string;
  match_id: string | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
  structured_negation: boolean | null;
};

type MatchScoreRow = {
  id: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  went_to_ot: boolean | null;
};

/** Pièce (a) du chantier paris équipe (GAPS_OUVERTS.md, cadré le
 *  23/08/2026) -- résolution des paris MATCH_TOTAL (structured_stat=
 *  "total_points"/"went_to_ot", jamais de structured_player_id -- paris SANS
 *  JOUEUR). Contrairement à resolveCalculableBets()/resolveCalculableSeriesBets()
 *  (qui lisent stats_box_scores, le pipeline Data NBA), la résolution ici
 *  n'a besoin QUE de `matches.home_score`/`away_score`/`went_to_ot` -- déjà
 *  synchronisés par le sync existant, aucune dépendance au pipeline Data NBA
 *  pour VÉRIFIER après coup (seulement pour PRÉDIRE avant le match, cf.
 *  compute_total_points_proba()/compute_overtime_proba() côté service).
 *  MATCH uniquement pour l'instant (même limite que la prédiction, pas
 *  encore de SÉRIE). Les autres stats "total_X" (reb/ast/fg3m/stl/blk/oreb)
 *  passent par resolveCalculableTeamStatBets() ci-dessus (structured_stat
 *  matché indépendamment du bet_subject qui l'a écrit) -- went_to_ot n'y a
 *  pas sa place (pas de colonne numérique à comparer à un seuil), traité
 *  ici à côté de total_points (24/08/2026, chantier "prolongation"). */
export async function resolveCalculableMatchTotalBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_stat, structured_threshold, structured_comparison, structured_negation")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .in("structured_stat", ["total_points", "went_to_ot"])
    .is("structured_player_id", null); // discrimine des paris JOUEUR -- garde explicite, jamais coexistant avec un vrai player_id
  const bets = (betsData ?? []) as EligibleMatchTotalBetRow[];
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, status, home_score, away_score, went_to_ot")
    .in("id", matchIds);
  const matchById = new Map(((matchesData ?? []) as MatchScoreRow[]).map((m) => [m.id, m]));

  // Paris déjà contestés -- jamais résolus automatiquement, même garde que
  // les 2 resolvers ci-dessus.
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
    if (!bet.match_id) {
      summary.skipped.push({ betId: bet.id, reason: "match manquant" });
      continue;
    }
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    // went_to_ot n'a ni seuil ni comparaison (probabilité directe) -- garde
    // restreinte à total_points, même principe que la garde symétrique côté
    // structuration (structureAndScoreBet.ts, NO_THRESHOLD_MATCH_STATS).
    if (bet.structured_stat === "total_points" && (bet.structured_threshold === null || !bet.structured_comparison)) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const match = matchById.get(bet.match_id);
    if (!match || match.status !== "FINISHED") {
      summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
      continue;
    }

    let outcome: "WON" | "LOST";
    let resolutionReason: string;

    if (bet.structured_stat === "went_to_ot") {
      if (match.went_to_ot === null) {
        // Match FINISHED mais signal pas encore synchronisé -- ne tranche
        // jamais sur une absence de donnée, même prudence que le cas
        // total_points ci-dessous.
        summary.skipped.push({ betId: bet.id, reason: "signal de prolongation pas encore synchronisé" });
        continue;
      }
      // Négation (même correctif que had_buzzer_beater, GAPS_OUVERTS.md
      // 25/08/2026, appliqué ici par précaution même sans exemple réel du
      // corpus -- "le match n'ira pas en prolongation" resterait sinon mal
      // résolu comme had_buzzer_beater l'a été).
      {
        const won = bet.structured_negation ? !match.went_to_ot : match.went_to_ot;
        outcome = won ? "WON" : "LOST";
      }
      resolutionReason = match.went_to_ot
        ? "Résolu automatiquement -- le match est allé en prolongation."
        : "Résolu automatiquement -- le match n'est pas allé en prolongation.";
    } else {
      if (match.home_score === null || match.away_score === null) {
        // Match FINISHED mais score pas encore synchronisé -- ne tranche
        // jamais sur une absence de donnée, même prudence que les 2 resolvers
        // ci-dessus.
        summary.skipped.push({ betId: bet.id, reason: "score du match pas encore synchronisé" });
        continue;
      }
      const total = match.home_score + match.away_score;
      const won =
        bet.structured_comparison === "UNDER" ? total < (bet.structured_threshold as number) : total > (bet.structured_threshold as number);
      outcome = won ? "WON" : "LOST";
      resolutionReason = `Résolu automatiquement via le score officiel du match (${total} points combinés).`;
    }

    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: resolutionReason,
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
