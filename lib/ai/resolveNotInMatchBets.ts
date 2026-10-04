import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import { type ResolveBetsSummary, type BoxScoreRow, computeOutcome, resolveNbaGameId, isBoxScoreSynced } from "./resolveBetsShared";

// p3-14 (04/10/2026) -- pari JOUEUR simple (scope MATCH) resté sans
// structured_player_id : surtout le joueur que l'IA juge absent des 2
// équipes (not_in_match, auto-validé à 0 % après confirmation du joueur,
// cf. structureAndScoreBet.ts), plus le cas rare où le micro-service n'a
// pas renvoyé d'id. resolveCalculableBets() (resolveMatchBets.ts) les
// ignore faute d'id -- avant ce resolver, ils restaient VALIDATED pour
// toujours (« Brunson +15 pts » sur LAL–GSW, Alpha NBA Cup).
//
// Le joueur est cherché par son NOM sur la feuille du match une fois le
// box score importé :
// - trouvé (nom complet) : l'IA s'était trompée, il a bien joué -- résolu
//   normalement sur ses vraies stats, et son id est enfin renseigné ;
// - nom de famille seul trouvé : ambigu (orthographe du prénom), laissé à
//   l'admin plutôt que de risquer un LOST à tort ;
// - absent : LOST, même règle que le joueur qui ne joue pas (p3-15).

type EligibleBetRow = {
  id: string;
  match_id: string | null;
  structured_player_name: string | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
  structured_team_id: string | null;
  structured_duel: unknown;
  structured_combo: unknown;
  structured_period: unknown;
  structured_roster_split: unknown;
  structured_roster_count: unknown;
  structured_superlative: unknown;
  structured_technical_fouls_count: unknown;
  structured_last_basket: unknown;
  structured_block_on_player: unknown;
};

type NamedBoxRow = BoxScoreRow & { player_id: number };
type PlayerNameRow = { player_id: number; first_name: string; family_name: string };

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** "Luka Dončić" / "luka doncic" -> "luka doncic" ; "Michael Porter Jr." ->
 *  "michael porter" -- accents, ponctuation et suffixes ignorés (l'IA
 *  normalise vers l'orthographe NBA, stats_joueurs ne garde pas toujours
 *  le suffixe). */
export function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’,-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !SUFFIXES.has(token))
    .join(" ");
}

export type NameMatch = { kind: "FOUND"; playerId: number } | { kind: "AMBIGUOUS" } | { kind: "ABSENT" };

/** Cherche `betName` parmi les joueurs de la feuille de match. */
export function matchPlayerByName(betName: string, players: PlayerNameRow[]): NameMatch {
  const target = normalizePlayerName(betName);
  if (!target) return { kind: "AMBIGUOUS" };
  const full = players.filter((p) => normalizePlayerName(`${p.first_name} ${p.family_name}`) === target);
  if (full.length === 1) return { kind: "FOUND", playerId: full[0].player_id };
  if (full.length > 1) return { kind: "AMBIGUOUS" };

  const targetFamily = target.split(" ").at(-1);
  const sameFamily = players.some((p) => normalizePlayerName(p.family_name).split(" ").at(-1) === targetFamily);
  return sameFamily ? { kind: "AMBIGUOUS" } : { kind: "ABSENT" };
}

/** Pari JOUEUR simple : aucune autre forme structurée renseignée. */
function isSinglePlayerShape(bet: EligibleBetRow): boolean {
  return (
    bet.structured_team_id === null &&
    bet.structured_duel === null &&
    bet.structured_combo === null &&
    bet.structured_period === null &&
    bet.structured_roster_split === null &&
    bet.structured_roster_count === null &&
    bet.structured_superlative === null &&
    bet.structured_technical_fouls_count === null &&
    bet.structured_last_basket === null &&
    bet.structured_block_on_player === null
  );
}

export const NOT_IN_MATCH_RESOLUTION_REASON =
  "Résolu automatiquement : le joueur visé ne figure pas sur la feuille de ce match (il ne joue pour aucune des deux équipes, ou n'a pas joué), un pari sur un joueur absent est perdu.";

export async function resolveCalculableNotInMatchBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select(
      "id, match_id, structured_player_id, structured_player_name, structured_stat, structured_threshold, structured_comparison, " +
        "structured_team_id, structured_duel, structured_combo, structured_period, structured_roster_split, structured_roster_count, " +
        "structured_superlative, structured_technical_fouls_count, structured_last_basket, structured_block_on_player"
    )
    .eq("scope", "MATCH")
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .is("structured_player_id", null)
    .not("structured_player_name", "is", null);
  const bets = ((betsData ?? []) as unknown as EligibleBetRow[]).filter(isSinglePlayerShape);
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const { data: matchesData } = await supabase.from("matches").select("id, status").in("id", matchIds);
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  // Même garde que resolveCalculableBets() : un pari contesté reste à l'admin.
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
    if (!bet.structured_player_name || !bet.structured_stat) {
      summary.skipped.push({ betId: bet.id, reason: "nom du joueur ou stat manquant" });
      continue;
    }

    const gameId = await resolveNbaGameId(supabase, bet.match_id);
    if (!gameId) {
      summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
      continue;
    }
    if (!(await isBoxScoreSynced(supabase, gameId))) {
      summary.skipped.push({ betId: bet.id, reason: "box score du match pas encore importé" });
      continue;
    }

    const { data: boxData } = await supabase
      .from("stats_box_scores")
      .select("player_id, minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, plus_minus, technical_fouls, tov")
      .eq("game_id", gameId);
    const boxRows = (boxData ?? []) as NamedBoxRow[];
    const { data: namesData } = await supabase
      .from("stats_joueurs")
      .select("player_id, first_name, family_name")
      .in(
        "player_id",
        boxRows.map((r) => r.player_id)
      );
    const nameMatch = matchPlayerByName(bet.structured_player_name, (namesData ?? []) as PlayerNameRow[]);

    if (nameMatch.kind === "AMBIGUOUS") {
      summary.skipped.push({ betId: bet.id, reason: "nom du joueur ambigu sur la feuille de match, à trancher par l'admin" });
      continue;
    }

    const box = nameMatch.kind === "FOUND" ? boxRows.find((r) => r.player_id === nameMatch.playerId) ?? null : null;
    const won = box
      ? computeOutcome(bet.structured_stat as StatCode, bet.structured_threshold, bet.structured_comparison, box)
      : false;
    if (won === null) {
      summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
      continue;
    }

    const outcome: "WON" | "LOST" = won ? "WON" : "LOST";
    const { data: updated } = await supabase
      .from("bets")
      .update({
        status: outcome,
        ...(nameMatch.kind === "FOUND" ? { structured_player_id: nameMatch.playerId } : {}),
        resolution_reason: box
          ? "Résolu automatiquement via les statistiques officielles du match."
          : NOT_IN_MATCH_RESOLUTION_REASON,
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
