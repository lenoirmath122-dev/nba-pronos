import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, computeOutcome, resolveNbaGameId, resolveNbaTeamId } from "./resolveBetsShared";

type StructuredRosterSplit = {
  kind: "STARTERS_SUM" | "BENCH_SUM" | "STARTERS_SHARE";
  team_id: string;
  stat: string;
};

type EligibleRosterSplitBetRow = {
  id: string;
  match_id: string | null;
  structured_roster_split: StructuredRosterSplit | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
};

export type RosterSplitBoxRow = Omit<BoxScoreRow, "minutes"> & { position: string | null };

export function sumBoxRows(rows: RosterSplitBoxRow[]): BoxScoreRow {
  const sum = (key: keyof Omit<BoxScoreRow, "minutes">) => rows.reduce((s, r) => s + (r[key] ?? 0), 0);
  return {
    minutes: null,
    pts: sum("pts"), reb: sum("reb"), ast: sum("ast"), fg3m: sum("fg3m"),
    stl: sum("stl"), blk: sum("blk"), ftm: sum("ftm"), fta: sum("fta"),
    fgm: sum("fgm"), fga: sum("fga"), fg3a: sum("fg3a"), oreb: sum("oreb"),
    plus_minus: sum("plus_minus"),
    technical_fouls: sum("technical_fouls"),
    tov: sum("tov"),
  };
}

/** Chantier "5 majeur / banc" (GAPS_OUVERTS.md, 24/08/2026) -- résolution
 *  des paris ROSTER_SPLIT. Lit stats_box_scores DIRECTEMENT (colonne
 *  position, "F"/"C"/"G" = titulaire, "" = remplaçant -- même chantier),
 *  pas de nouvelle table. resolveNbaTeamId() (défini plus haut, chantier
 *  % tir équipe) fait le pont app teams.id (uuid) -> stats_equipes.team_id
 *  (numérique NBA) -- stats_box_scores.team_id est dans cet espace NBA,
 *  PAS l'uuid app (piège déjà rencontré par les resolvers précédents,
 *  réutilisé ici plutôt que recontourné). MATCH uniquement, même limite
 *  que les autres resolvers de ce fichier. */
export async function resolveCalculableRosterSplitBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, match_id, structured_roster_split, structured_stat, structured_threshold, structured_comparison")
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .not("structured_roster_split", "is", null);
  const bets = (betsData ?? []) as EligibleRosterSplitBetRow[];
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
    if (!bet.match_id || !bet.structured_roster_split || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "5 majeur/banc structuré manquant" });
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
    const rs = bet.structured_roster_split;
    const nbaTeamId = await resolveNbaTeamId(supabase, rs.team_id);
    if (nbaTeamId === null) {
      summary.skipped.push({ betId: bet.id, reason: "équipe NBA correspondante introuvable" });
      continue;
    }

    const { data: rows } = await supabase
      .from("stats_box_scores")
      .select("player_id, position, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov")
      .eq("game_id", gameId)
      .eq("team_id", nbaTeamId);
    if (!rows || rows.length === 0) {
      summary.skipped.push({ betId: bet.id, reason: "pas encore de stats synchronisées pour cette équipe" });
      continue;
    }
    const boxRows = rows as RosterSplitBoxRow[];
    const starters = boxRows.filter((r) => r.position);
    const bench = boxRows.filter((r) => !r.position);

    const stat = bet.structured_stat as StatCode;
    let won: boolean | null;
    let detail: string;
    if (rs.kind === "STARTERS_SUM") {
      won = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, sumBoxRows(starters));
      detail = `total titulaires (${starters.length} joueurs, position renseignée)`;
    } else if (rs.kind === "BENCH_SUM") {
      won = computeOutcome(stat, bet.structured_threshold, bet.structured_comparison, sumBoxRows(bench));
      detail = `total banc (${bench.length} joueurs, position vide)`;
    } else {
      // STARTERS_SHARE : pas un seuil brut, une FRACTION du total équipe --
      // même calcul que POINT_SHARE_PCT (computePeriodTeamOutcome plus haut).
      if (bet.structured_threshold === null || !bet.structured_comparison) {
        won = null;
        detail = "";
      } else {
        const starterTotal = (sumBoxRows(starters)[stat as keyof BoxScoreRow] as number | null) ?? 0;
        const teamTotal = (sumBoxRows(boxRows)[stat as keyof BoxScoreRow] as number | null) ?? 0;
        const share = teamTotal > 0 ? starterTotal / teamTotal : null;
        won = share === null ? null : bet.structured_comparison === "UNDER" ? share < bet.structured_threshold : share > bet.structured_threshold;
        detail = share === null ? "" : `${(share * 100).toFixed(0)}% des points de l'équipe marqués par les titulaires`;
      }
    }

    if (won === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant pour ce pari 5 majeur/banc" });
      continue;
    }
    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        resolution_reason: `Résolu automatiquement via les statistiques officielles du match (${detail}).`,
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
