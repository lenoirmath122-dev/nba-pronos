import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { resolveNbaGameId, rowStatValue } from "@/lib/ai/resolveBetsShared";

// Vraies stats des joueurs cités dans un pari combo réglé (« Jokic et SGA en
// triple double » → « Jokic : 20 pts · 9 reb · 7 ast »), affichées sous le
// verdict dans la popup des paris des autres. Lecture à l'affichage, rien
// n'est stocké : couvre aussi les paris réglés avant cette fonctionnalité.
// Client service : stats_box_scores / stats_joueurs / entity_mappings sont
// fermés aux joueurs par la RLS, et ne contiennent que des stats publiques.

type ComboCondition = { kind: string; stats: string[]; player_ids?: number[] | null };
export type ComboForStatLines = { conditions: { or: ComboCondition[] }[] };

type BetForStatLines = { id: string; matchId: string; combo: ComboForStatLines | null };

const BOX_COLUMNS = "game_id, player_id, minutes, pts, reb, ast, fg3m, stl, blk, ftm, fta, fgm, fga, fg3a, oreb, tov, pf";

// dd/td : les trois catégories du critère, plus les deux autres pour voir si
// le joueur était proche.
const DOUBLE_DIGIT_STATS = ["pts", "reb", "ast", "stl", "blk"];
const SHORT_LABEL: Record<string, string> = {
  pts: "pts",
  reb: "reb",
  ast: "ast",
  fg3m: "3pts",
  stl: "stl",
  blk: "blk",
  oreb: "reb off.",
  dreb: "reb déf.",
  tov: "pertes",
  pf: "fautes",
  fga: "tirs tentés",
  fgm: "tirs réussis",
  fg3a: "3pts tentés",
  ftm: "LF réussis",
  fta: "LF tentés",
};

function statParts(stat: string, row: Record<string, unknown>): string[] {
  if (stat === "dd" || stat === "td") return DOUBLE_DIGIT_STATS.map((s) => `${rowStatValue(s, row)} ${SHORT_LABEL[s]}`);
  if (stat === "min") return [`${Math.round(rowStatValue("min", row))} min`];
  if (stat === "ft") return [`${rowStatValue("ftm", row)}/${rowStatValue("fta", row)} LF`];
  if (stat === "fg") return [`${rowStatValue("fgm", row)}/${rowStatValue("fga", row)} tirs`];
  if (stat === "fg3") return [`${rowStatValue("fg3m", row)}/${rowStatValue("fg3a", row)} à 3pts`];
  const label = SHORT_LABEL[stat];
  return label ? [`${rowStatValue(stat, row)} ${label}`] : [];
}

/** Une ligne par joueur du combo, par pari. Aucune entrée si rien à montrer. */
export async function loadBetStatLines(bets: BetForStatLines[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const withPlayers = bets.filter((b) =>
    b.combo?.conditions.some((g) => g.or.some((c) => c.kind === "PLAYER" && (c.player_ids?.length ?? 0) > 0))
  );
  if (withPlayers.length === 0) return out;

  const supabase = getServiceClient();
  const gameIdByMatch = new Map<string, string>();
  for (const matchId of new Set(withPlayers.map((b) => b.matchId))) {
    const gameId = await resolveNbaGameId(supabase, matchId);
    if (gameId) gameIdByMatch.set(matchId, gameId);
  }
  if (gameIdByMatch.size === 0) return out;

  const playerIds = [
    ...new Set(withPlayers.flatMap((b) => b.combo!.conditions.flatMap((g) => g.or.flatMap((c) => c.player_ids ?? [])))),
  ];
  const [{ data: boxData }, { data: namesData }] = await Promise.all([
    supabase.from("stats_box_scores").select(BOX_COLUMNS).in("game_id", [...gameIdByMatch.values()]).in("player_id", playerIds),
    supabase.from("stats_joueurs").select("player_id, family_name").in("player_id", playerIds),
  ]);
  const boxByKey = new Map<string, Record<string, unknown>>();
  for (const r of (boxData ?? []) as Record<string, unknown>[]) boxByKey.set(`${r.game_id}:${r.player_id}`, r);
  const nameById = new Map((namesData ?? []).map((p) => [p.player_id as number, p.family_name as string]));

  for (const bet of withPlayers) {
    const gameId = gameIdByMatch.get(bet.matchId);
    if (!gameId) continue;
    const lines: string[] = [];
    const seen = new Set<number>();
    for (const group of bet.combo!.conditions) {
      for (const cond of group.or) {
        if (cond.kind !== "PLAYER") continue;
        for (const playerId of cond.player_ids ?? []) {
          if (seen.has(playerId)) continue;
          const name = nameById.get(playerId) ?? `Joueur ${playerId}`;
          const row = boxByKey.get(`${gameId}:${playerId}`);
          if (!row) {
            seen.add(playerId);
            lines.push(`${name} : n’a pas joué`);
            continue;
          }
          const parts = [...new Set(cond.stats.flatMap((s) => statParts(s, row)))];
          if (parts.length === 0) continue;
          seen.add(playerId);
          lines.push(`${name} : ${parts.join(" · ")}`);
        }
      }
    }
    if (lines.length > 0) out.set(bet.id, lines);
  }
  return out;
}
