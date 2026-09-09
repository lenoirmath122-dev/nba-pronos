import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import { type ResolveBetsSummary, resolveNbaGameId } from "./resolveBetsShared";

// ============================================================================
// Chantier "événements de match" (étape 5 du plan de reprise post-audit,
// 25/08/2026, GAPS_OUVERTS.md) -- total_timeouts/had_backcourt_turnover,
// bet_subject=MATCH_TOTAL. Résolveur SÉPARÉ de resolveCalculableMatchTotalBets()
// ci-dessus (total_points/went_to_ot) : celui-ci lit `matches` (app-side,
// peuplé par lib/sync/results.ts), ces 2 nouvelles stats vivent côté
// Data NBA (stats_matchs/stats_box_scores, peuplées par refresh_daily.py) --
// même pont resolveNbaGameId() que resolveCalculableTeamStatBets().
// ============================================================================

type EligibleGameEventMatchTotalBetRow = {
  id: string;
  match_id: string | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
  structured_negation: boolean | null;
};

export async function resolveCalculableGameEventBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_stat, structured_threshold, structured_comparison, structured_negation")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .in("structured_stat", ["total_timeouts", "had_backcourt_turnover", "had_buzzer_beater"])
    .is("structured_player_id", null); // discrimine des paris JOUEUR, même garde que resolveCalculableMatchTotalBets()
  const bets = (betsData ?? []) as EligibleGameEventMatchTotalBetRow[];
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
    // had_backcourt_turnover n'a ni seuil ni comparaison (probabilité
    // directe) -- garde restreinte à total_timeouts, même principe que la
    // garde symétrique côté structuration (NO_THRESHOLD_MATCH_STATS).
    if (bet.structured_stat === "total_timeouts" && (bet.structured_threshold === null || !bet.structured_comparison)) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }

    let outcome: "WON" | "LOST";
    let resolutionReason: string;

    if (bet.structured_stat === "total_timeouts") {
      const { data: match } = await supabase
        .from("stats_matchs")
        .select("home_timeouts, away_timeouts")
        .eq("game_id", gameId)
        .maybeSingle<{ home_timeouts: number | null; away_timeouts: number | null }>();
      if (!match || match.home_timeouts === null || match.away_timeouts === null) {
        summary.skipped.push({ betId: bet.id, reason: "temps morts pas encore synchronisés pour ce match" });
        continue;
      }
      const total = match.home_timeouts + match.away_timeouts;
      const won =
        bet.structured_comparison === "UNDER" ? total < (bet.structured_threshold as number) : total > (bet.structured_threshold as number);
      outcome = won ? "WON" : "LOST";
      resolutionReason = `Résolu automatiquement via les statistiques officielles du match (${total} temps morts combinés).`;
    } else if (bet.structured_stat === "had_backcourt_turnover") {
      // had_backcourt_turnover : au moins 1 sur TOUT le match (les 2
      // équipes) -- pas d'attribution match-wide stockée directement,
      // sommée depuis stats_box_scores.backcourt_turnovers (même geste que
      // resolveCalculableSuperlativeBets(), qui lit aussi TOUS les joueurs
      // du match sans filtre team_id).
      const { data: rows } = await supabase.from("stats_box_scores").select("backcourt_turnovers").eq("game_id", gameId);
      if (!rows || rows.length === 0) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
        continue;
      }
      const total = rows.reduce((sum, r) => sum + ((r.backcourt_turnovers as number | null) ?? 0), 0);
      // Négation (bug réel trouvé le 25/08/2026, GAPS_OUVERTS.md) -- "aucun
      // retour en zone durant le match" est le miroir exact du bug trouvé
      // sur had_buzzer_beater (voir ci-dessous), corrigé par précaution ici
      // aussi même sans exemple réel du corpus (même champ, même risque).
      const eventOccurred = total > 0;
      const won = bet.structured_negation ? !eventOccurred : eventOccurred;
      outcome = won ? "WON" : "LOST";
      resolutionReason = eventOccurred
        ? "Résolu automatiquement -- au moins un retour en zone a eu lieu durant le match."
        : "Résolu automatiquement -- aucun retour en zone n'a eu lieu durant le match.";
    } else {
      // had_buzzer_beater (étape 6, GAPS_OUVERTS.md) -- flag MATCH direct
      // (stats_matchs.had_buzzer_beater), contrairement à
      // had_backcourt_turnover -- rien à sommer ici, la valeur est déjà
      // agrégée à la synchro (refresh_daily.py/backfill_game_events.py).
      const { data: match } = await supabase
        .from("stats_matchs")
        .select("had_buzzer_beater")
        .eq("game_id", gameId)
        .maybeSingle<{ had_buzzer_beater: boolean | null }>();
      if (!match || match.had_buzzer_beater === null) {
        summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour ce match" });
        continue;
      }
      // Bug réel trouvé en testant en conditions réelles (25/08/2026,
      // GAPS_OUVERTS.md) : le pari réel du corpus ("Aucun panier marqué au
      // buzzer durant le match") est une NÉGATION -- résolu à tort en LOST
      // sur un vrai match SANS buzzer beater avant ce correctif
      // (structured_negation inverse le résultat quand le texte affirme
      // l'ABSENCE de l'événement, cf. migration 20260825190000).
      const eventOccurred = match.had_buzzer_beater;
      const won = bet.structured_negation ? !eventOccurred : eventOccurred;
      outcome = won ? "WON" : "LOST";
      resolutionReason = eventOccurred
        ? "Résolu automatiquement -- au moins un panier a été marqué au buzzer durant le match."
        : "Résolu automatiquement -- aucun panier n'a été marqué au buzzer durant le match.";
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
