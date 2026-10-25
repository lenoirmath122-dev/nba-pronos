import { addDays } from "@/lib/recaps/period";
import { computeWeeklyStandings, type WeeklySnapshotRow } from "@/lib/weekly/standings";
import type { getServiceClient } from "@/lib/supabase/service";
import type { PopupUserRow } from "./types";

// Bloc « classement » de la popup hebdomadaire (prompt v6) : podium de la
// semaine, plus grosse remontée et plus grosse chute au classement général,
// lanterne rouge. Calculé par le code à partir des snapshots quotidiens du
// classement ; le rédacteur ne reçoit que des pseudos et des nombres.
//
// Semaine figée : mêmes snapshots que le figement (`weekly_rankings`). Semaine
// en cours (essai admin) : départ du lundi n-1, fin = dernier snapshot pris.

type Client = ReturnType<typeof getServiceClient>;

export type RankingSnapshotRow = WeeklySnapshotRow & { rank: number };

export interface RankingFacts {
  /** Fin prise sur le dernier snapshot disponible (semaine pas encore close). */
  inProgress: boolean;
  /** Joueurs présents au snapshot de fin. */
  players: number;
  /** Rangs 1 à 3 de la semaine (ex aequo compris, 5 au plus), points > 0. */
  podium: { userId: string; rank: number; points: number }[];
  /** Plus gros gain de places au général (au moins 2 places). */
  climb: { userId: string; from: number; to: number } | null;
  /** Plus grosse perte de places au général (au moins 2 places). */
  drop: { userId: string; from: number; to: number } | null;
  /** Dernier(s) de la semaine ; `userIds` vide si plus de 3 ex aequo. */
  last: { userIds: string[]; points: number; tied: number } | null;
}

const PODIUM_MAX = 5;
const LAST_MAX_NAMED = 3;
const MOVE_MIN = 2;
/** En dessous, pas de lanterne rouge (elle serait sur le podium). */
const LAST_MIN_PLAYERS = 5;

/** Faits de classement, purs, à partir des deux snapshots. */
export function buildRankingFacts(
  start: readonly RankingSnapshotRow[],
  end: readonly RankingSnapshotRow[],
  inProgress: boolean,
): RankingFacts | null {
  if (end.length === 0 || start.length === 0) return null;
  const { standings } = computeWeeklyStandings([...start], [...end]);

  const podium = standings
    .filter((s) => s.rank <= 3 && s.points > 0)
    .slice(0, PODIUM_MAX)
    .map((s) => ({ userId: s.userId, rank: s.rank, points: s.points }));

  const startRank = new Map(start.map((r) => [r.user_id, r.rank]));
  let climb: RankingFacts["climb"] = null;
  let drop: RankingFacts["drop"] = null;
  for (const row of end) {
    const from = startRank.get(row.user_id);
    if (from === undefined) continue;
    const gain = from - row.rank;
    if (gain >= MOVE_MIN && (!climb || gain > climb.from - climb.to)) climb = { userId: row.user_id, from, to: row.rank };
    if (-gain >= MOVE_MIN && (!drop || -gain > drop.to - drop.from)) drop = { userId: row.user_id, from, to: row.rank };
  }

  let last: RankingFacts["last"] = null;
  if (standings.length >= LAST_MIN_PLAYERS) {
    const minPoints = Math.min(...standings.map((s) => s.points));
    const bottom = standings.filter((s) => s.points === minPoints);
    const onPodium = new Set(podium.map((p) => p.userId));
    if (!bottom.some((s) => onPodium.has(s.userId))) {
      last = {
        userIds: bottom.length <= LAST_MAX_NAMED ? bottom.map((s) => s.userId) : [],
        points: minPoints,
        tied: bottom.length,
      };
    }
  }

  if (podium.length === 0 && !climb && !drop && !last) return null;
  return { inProgress, players: end.length, podium, climb, drop, last };
}

/** Tous les joueurs nommés par les faits (pour les classer et les citer). */
export function rankingUserIds(facts: RankingFacts | null): string[] {
  if (!facts) return [];
  const ids = [
    ...facts.podium.map((p) => p.userId),
    ...(facts.climb ? [facts.climb.userId] : []),
    ...(facts.drop ? [facts.drop.userId] : []),
    ...(facts.last?.userIds ?? []),
  ];
  return [...new Set(ids)];
}

/**
 * Retire des faits les joueurs non citables (bloqués, désengagés, inactifs).
 * Une lanterne rouge dont un joueur nommé est retiré passe en anonyme.
 */
export function filterRankingFacts(facts: RankingFacts | null, citable: (userId: string) => boolean): RankingFacts | null {
  if (!facts) return null;
  const podium = facts.podium.filter((p) => citable(p.userId));
  const climb = facts.climb && citable(facts.climb.userId) ? facts.climb : null;
  const drop = facts.drop && citable(facts.drop.userId) ? facts.drop : null;
  let last = facts.last;
  if (last && last.userIds.some((id) => !citable(id))) last = { ...last, userIds: [] };
  if (podium.length === 0 && !climb && !drop && !last) return null;
  return { ...facts, podium, climb, drop, last };
}

/** Ligne CLASSEMENT du rédacteur (pseudos préfixés de « @ »). */
export function rankingInputLine(facts: RankingFacts | null, pseudoOf: (userId: string) => string): string {
  if (!facts) return "null";
  const at = (id: string) => `@${pseudoOf(id)}`;
  return JSON.stringify({
    semaine_en_cours: facts.inProgress,
    joueurs: facts.players,
    podium: facts.podium.map((p) => ({ pseudo: at(p.userId), rang: p.rank, points_semaine: p.points })),
    remontee: facts.climb ? { pseudo: at(facts.climb.userId), rang_avant: facts.climb.from, rang_apres: facts.climb.to } : null,
    chute: facts.drop ? { pseudo: at(facts.drop.userId), rang_avant: facts.drop.from, rang_apres: facts.drop.to } : null,
    lanterne_rouge: facts.last
      ? { pseudos: facts.last.userIds.map(at), points_semaine: facts.last.points, ex_aequo: facts.last.tied }
      : null,
  });
}

/**
 * Lit les deux snapshots de la semaine. `null` si la semaine n'a pas de
 * départ ou pas de fin exploitable (aucun bloc classement, sans erreur).
 */
export type LoadedRanking = { facts: RankingFacts | null; users: Map<string, PopupUserRow> };

export async function loadRankingFacts(
  client: Client,
  competitionId: string,
  weekEnd: string,
): Promise<LoadedRanking> {
  const fail = (context: string, error: { message: string }): never => {
    throw new Error(`${context} : ${error.message}`);
  };

  const frozen = await client
    .from("weekly_rankings")
    .select("start_snapshot_date, end_snapshot_date")
    .eq("competition_id", competitionId)
    .eq("week_end_date", weekEnd)
    .maybeSingle<{ start_snapshot_date: string; end_snapshot_date: string }>();
  if (frozen.error) fail("Lecture du classement figé", frozen.error);

  let startDate: string | null = frozen.data?.start_snapshot_date ?? null;
  let endDate: string | null = frozen.data?.end_snapshot_date ?? null;
  let inProgress = false;

  const firstDate = async (filter: "gte" | "lte", date: string, ascending: boolean): Promise<string | null> => {
    const query = client.from("leaderboard_snapshots").select("snapshot_date").eq("competition_id", competitionId);
    const { data, error } = await (filter === "gte" ? query.gte("snapshot_date", date) : query.lte("snapshot_date", date))
      .order("snapshot_date", { ascending })
      .limit(1);
    if (error) fail("Lecture des dates de snapshot", error);
    const row = (data ?? [])[0] as { snapshot_date?: string } | undefined;
    return row?.snapshot_date ?? null;
  };

  if (!startDate || !endDate) {
    startDate = await firstDate("lte", addDays(weekEnd, -7), false);
    endDate = await firstDate("gte", weekEnd, true);
    if (!endDate) {
      // Semaine pas encore close : dernier snapshot pris.
      endDate = await firstDate("gte", addDays(weekEnd, -6), false);
      inProgress = true;
    }
  }
  const none: LoadedRanking = { facts: null, users: new Map() };
  if (!startDate || !endDate || startDate >= endDate) return none;

  const rows = async (date: string): Promise<RankingSnapshotRow[]> => {
    const { data, error } = await client
      .from("leaderboard_snapshots")
      .select("user_id, rank, total_points, correct_match_winners, exact_margins")
      .eq("competition_id", competitionId)
      .eq("snapshot_date", date);
    if (error) fail(`Lecture du snapshot du ${date}`, error);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      user_id: String(r.user_id),
      rank: Number(r.rank),
      total_points: Number(r.total_points),
      correct_match_winners: r.correct_match_winners === null ? null : Number(r.correct_match_winners),
      exact_margins: r.exact_margins === null ? null : Number(r.exact_margins),
    }));
  };
  const [start, end] = await Promise.all([rows(startDate), rows(endDate)]);
  const facts = buildRankingFacts(start, end, inProgress);
  const ids = rankingUserIds(facts);
  if (!facts || ids.length === 0) return { facts, users: new Map() };

  const { data, error } = await client
    .from("users")
    .select("id, pseudo, status, popup_mentions_opt_out")
    .in("id", ids);
  if (error) fail("Lecture des joueurs du classement", error);
  const users = new Map<string, PopupUserRow>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    users.set(String(r.id), {
      id: String(r.id),
      pseudo: String(r.pseudo ?? ""),
      status: String(r.status ?? ""),
      popup_mentions_opt_out: r.popup_mentions_opt_out === true,
    });
  }
  return { facts, users };
}
