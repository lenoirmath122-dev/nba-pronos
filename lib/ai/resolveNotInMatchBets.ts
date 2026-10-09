import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { recomputeBet } from "@/lib/scoring/recompute";
import type { StatCode } from "./statCodes";
import {
  type ResolveBetsSummary,
  type BoxScoreRow,
  type SupabaseServiceClient,
  computeOutcome,
  formatActualStatReason,
  resolveNbaGameId,
  isBoxScoreSynced,
  DNP_RESOLUTION_REASON,
} from "./resolveBetsShared";

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
//
// Suite de p3-14 (05/10/2026) -- mêmes règles étendues aux autres formes
// qui nomment un joueur sans id :
// - pari SÉRIE simple (not_in_match sur une série) : cherché sur chaque
//   match terminé de la série ; trouvé -> id renseigné, absent de tous les
//   matchs d'une série terminée -> LOST ;
// - pari période joueur / superlatif dont le micro-service n'a pas renvoyé
//   d'id : trouvé -> id renseigné, absent -> LOST.
// Quand le joueur est trouvé hors du cas simple, ce resolver se contente de
// renseigner l'id : le resolver de la famille (série, période, superlatif)
// tranche à sa prochaine passe, avec ses propres règles. Le dernier panier
// n'est pas concerné (predictLastBasket() renvoie toujours un id).

type EligibleBetRow = {
  id: string;
  scope: "MATCH" | "SERIES";
  match_id: string | null;
  series_id: string;
  structured_player_name: string | null;
  structured_stat: string | null;
  structured_threshold: number | null;
  structured_comparison: "OVER" | "UNDER" | null;
  structured_team_id: string | null;
  structured_duel: unknown;
  structured_combo: unknown;
  structured_period: Record<string, unknown> | null;
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

type BetShape = "SINGLE" | "PERIOD" | "SUPERLATIVE";

/** Forme du pari parmi celles qui nomment UN joueur : JOUEUR simple (aucune
 *  autre forme structurée), période joueur ou superlatif. `null` pour tout
 *  le reste (duel, combo...), jamais traité ici. */
function namedPlayerShape(bet: EligibleBetRow): BetShape | null {
  const others = [
    bet.structured_team_id,
    bet.structured_duel,
    bet.structured_combo,
    bet.structured_roster_split,
    bet.structured_roster_count,
    bet.structured_technical_fouls_count,
    bet.structured_last_basket,
    bet.structured_block_on_player,
  ];
  if (others.some((value) => value !== null)) return null;
  if (bet.structured_period === null && bet.structured_superlative === null) return "SINGLE";
  if (bet.scope !== "MATCH") return null;
  if (bet.structured_period !== null && bet.structured_superlative === null) return "PERIOD";
  if (bet.structured_period === null && bet.structured_superlative !== null) return "SUPERLATIVE";
  return null;
}

export const NOT_IN_MATCH_RESOLUTION_REASON =
  "Résolu automatiquement : le joueur visé ne figure pas sur la feuille de ce match (il ne joue pour aucune des deux équipes, ou n'a pas joué), un pari sur un joueur absent est perdu.";

export const NOT_IN_SERIES_RESOLUTION_REASON =
  "Résolu automatiquement : série terminée, le joueur visé ne figure sur la feuille d'aucun de ses matchs, un pari sur un joueur absent est perdu.";

const PLAYER_IDENTIFIED_REASON = "joueur identifié sur la feuille de match, tranché par le resolver de sa famille à la prochaine passe";

/** Box score + noms des joueurs d'un match NBA déjà importé. */
async function loadMatchSheet(
  supabase: SupabaseServiceClient,
  gameId: string
): Promise<{ boxRows: NamedBoxRow[]; players: PlayerNameRow[] }> {
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
  return { boxRows, players: (namesData ?? []) as PlayerNameRow[] };
}

/** Renseigne l'id du joueur retrouvé sur la feuille, pour que le resolver
 *  de la famille prenne le relais (une période le lit dans
 *  structured_period.player_id, pas dans structured_player_id). */
async function fillPlayerId(supabase: SupabaseServiceClient, bet: EligibleBetRow, playerId: number): Promise<boolean> {
  const { data: updated } = await supabase
    .from("bets")
    .update({
      structured_player_id: playerId,
      ...(bet.structured_period ? { structured_period: { ...bet.structured_period, player_id: playerId } } : {}),
    })
    .eq("id", bet.id)
    .eq("status", "VALIDATED")
    .is("structured_player_id", null)
    .select("id")
    .maybeSingle();
  return Boolean(updated);
}

async function settle(
  supabase: SupabaseServiceClient,
  summary: ResolveBetsSummary,
  betId: string,
  outcome: "WON" | "LOST",
  reason: string,
  playerId: number | null
): Promise<void> {
  const { data: updated } = await supabase
    .from("bets")
    .update({
      status: outcome,
      ...(playerId !== null ? { structured_player_id: playerId } : {}),
      resolution_reason: reason,
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: null,
    })
    .eq("id", betId)
    .eq("status", "VALIDATED")
    .select("id")
    .maybeSingle();
  if (!updated) {
    summary.skipped.push({ betId, reason: "déjà résolu entre-temps (concurrence)" });
    return;
  }
  await recomputeBet(betId);
  summary.resolved.push({ betId, outcome });
}

async function resolveMatchScopeBet(
  supabase: SupabaseServiceClient,
  summary: ResolveBetsSummary,
  bet: EligibleBetRow,
  shape: BetShape,
  finishedMatchIds: Set<string>
): Promise<void> {
  if (!bet.match_id || !finishedMatchIds.has(bet.match_id)) {
    summary.skipped.push({ betId: bet.id, reason: "match pas encore terminé" });
    return;
  }
  if (!bet.structured_player_name || (shape !== "SUPERLATIVE" && !bet.structured_stat)) {
    summary.skipped.push({ betId: bet.id, reason: "nom du joueur ou stat manquant" });
    return;
  }

  const gameId = await resolveNbaGameId(supabase, bet.match_id);
  if (!gameId) {
    summary.skipped.push({ betId: bet.id, reason: "match NBA correspondant introuvable" });
    return;
  }
  if (!(await isBoxScoreSynced(supabase, gameId))) {
    summary.skipped.push({ betId: bet.id, reason: "box score du match pas encore importé" });
    return;
  }

  const { boxRows, players } = await loadMatchSheet(supabase, gameId);
  const nameMatch = matchPlayerByName(bet.structured_player_name, players);

  if (nameMatch.kind === "AMBIGUOUS") {
    summary.skipped.push({ betId: bet.id, reason: "nom du joueur ambigu sur la feuille de match, à trancher par l'admin" });
    return;
  }
  if (nameMatch.kind === "ABSENT") {
    await settle(supabase, summary, bet.id, "LOST", NOT_IN_MATCH_RESOLUTION_REASON, null);
    return;
  }

  if (shape !== "SINGLE") {
    const filled = await fillPlayerId(supabase, bet, nameMatch.playerId);
    summary.skipped.push({
      betId: bet.id,
      reason: filled ? PLAYER_IDENTIFIED_REASON : "déjà résolu entre-temps (concurrence)",
    });
    return;
  }

  const box = boxRows.find((r) => r.player_id === nameMatch.playerId) ?? null;
  const won = box
    ? computeOutcome(bet.structured_stat as StatCode, bet.structured_threshold, bet.structured_comparison, box)
    : false;
  if (won === null) {
    summary.skipped.push({ betId: bet.id, reason: "seuil/comparaison manquant" });
    return;
  }
  await settle(
    supabase,
    summary,
    bet.id,
    won ? "WON" : "LOST",
    box
      ? formatActualStatReason(bet.structured_player_name, bet.structured_stat as StatCode, box)
      : DNP_RESOLUTION_REASON,
    nameMatch.playerId
  );
}

/** Pari SÉRIE : le joueur est cherché sur chaque match terminé. Trouvé sur
 *  un seul -> id renseigné, resolveCalculableSeriesBets() tranche (« au
 *  moins une fois sur la série », DNP sur un match = pas de hit). Absent
 *  partout -> LOST, mais seulement série terminée et toutes ses feuilles
 *  importées (même prudence que resolveCalculableSeriesBets()). */
async function resolveSeriesScopeBet(
  supabase: SupabaseServiceClient,
  summary: ResolveBetsSummary,
  bet: EligibleBetRow,
  seriesOver: boolean,
  finishedMatchIds: string[]
): Promise<void> {
  if (!bet.structured_player_name || !bet.structured_stat) {
    summary.skipped.push({ betId: bet.id, reason: "nom du joueur ou stat manquant" });
    return;
  }

  let ambiguous = false;
  let dataMissing = false;
  for (const matchId of finishedMatchIds) {
    const gameId = await resolveNbaGameId(supabase, matchId);
    if (!gameId || !(await isBoxScoreSynced(supabase, gameId))) {
      dataMissing = true;
      continue;
    }
    const { players } = await loadMatchSheet(supabase, gameId);
    const nameMatch = matchPlayerByName(bet.structured_player_name, players);
    if (nameMatch.kind === "FOUND") {
      const filled = await fillPlayerId(supabase, bet, nameMatch.playerId);
      summary.skipped.push({
        betId: bet.id,
        reason: filled ? PLAYER_IDENTIFIED_REASON : "déjà résolu entre-temps (concurrence)",
      });
      return;
    }
    if (nameMatch.kind === "AMBIGUOUS") ambiguous = true;
  }

  if (ambiguous) {
    summary.skipped.push({ betId: bet.id, reason: "nom du joueur ambigu sur une feuille de match, à trancher par l'admin" });
    return;
  }
  if (!seriesOver) {
    summary.skipped.push({ betId: bet.id, reason: "série pas encore terminée, joueur pas encore trouvé" });
    return;
  }
  if (dataMissing || finishedMatchIds.length === 0) {
    summary.skipped.push({ betId: bet.id, reason: "données manquantes pour au moins un match de la série" });
    return;
  }
  await settle(supabase, summary, bet.id, "LOST", NOT_IN_SERIES_RESOLUTION_REASON, null);
}

export async function resolveCalculableNotInMatchBets(): Promise<ResolveBetsSummary> {
  const supabase = getServiceClient();
  const summary: ResolveBetsSummary = { resolved: [], skipped: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select(
      "id, scope, match_id, series_id, structured_player_id, structured_player_name, structured_stat, structured_threshold, structured_comparison, " +
        "structured_team_id, structured_duel, structured_combo, structured_period, structured_roster_split, structured_roster_count, " +
        "structured_superlative, structured_technical_fouls_count, structured_last_basket, structured_block_on_player"
    )
    .eq("is_calculable", true)
    .eq("status", "VALIDATED")
    .is("structured_player_id", null)
    .not("structured_player_name", "is", null);
  const bets = ((betsData ?? []) as unknown as EligibleBetRow[])
    .map((bet) => ({ bet, shape: namedPlayerShape(bet) }))
    .filter((entry): entry is { bet: EligibleBetRow; shape: BetShape } => entry.shape !== null);
  if (bets.length === 0) return summary;

  const matchIds = [...new Set(bets.map(({ bet }) => bet.match_id).filter((id): id is string => id !== null))];
  const seriesIds = [...new Set(bets.filter(({ bet }) => bet.scope === "SERIES").map(({ bet }) => bet.series_id))];

  const { data: matchesData } = matchIds.length > 0
    ? await supabase.from("matches").select("id, status").in("id", matchIds)
    : { data: [] };
  const finishedMatchIds = new Set(
    (matchesData ?? []).filter((m) => m.status === "FINISHED").map((m) => m.id as string)
  );

  const seriesStatusById = new Map<string, string>();
  const finishedMatchIdsBySeries = new Map<string, string[]>();
  if (seriesIds.length > 0) {
    const { data: seriesData } = await supabase.from("series").select("id, official_status").in("id", seriesIds);
    for (const s of seriesData ?? []) seriesStatusById.set(s.id as string, s.official_status as string);
    const { data: seriesMatches } = await supabase.from("matches").select("id, series_id, status").in("series_id", seriesIds);
    for (const m of seriesMatches ?? []) {
      if (m.status !== "FINISHED") continue;
      const seriesId = m.series_id as string;
      finishedMatchIdsBySeries.set(seriesId, [...(finishedMatchIdsBySeries.get(seriesId) ?? []), m.id as string]);
    }
  }

  // Même garde que resolveCalculableBets() : un pari contesté reste à l'admin.
  const { data: pendingCorrections } = await supabase
    .from("correction_requests")
    .select("target_bet_id")
    .eq("status", "PENDING")
    .in(
      "target_bet_id",
      bets.map(({ bet }) => bet.id)
    );
  const contestedBetIds = new Set((pendingCorrections ?? []).map((r) => r.target_bet_id as string));

  for (const { bet, shape } of bets) {
    if (contestedBetIds.has(bet.id)) {
      summary.skipped.push({ betId: bet.id, reason: "requête de correction en attente" });
      continue;
    }
    if (bet.scope === "SERIES") {
      await resolveSeriesScopeBet(
        supabase,
        summary,
        bet,
        seriesStatusById.get(bet.series_id) === "FINISHED",
        finishedMatchIdsBySeries.get(bet.series_id) ?? []
      );
    } else {
      await resolveMatchScopeBet(supabase, summary, bet, shape, finishedMatchIds);
    }
  }

  return summary;
}
