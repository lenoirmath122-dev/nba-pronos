import "server-only";
import { getServiceClient } from "@/lib/supabase/service";
import { addDays, recapBoundaryIso } from "@/lib/recaps/period";
import { LOAD_MAX_ROWS, LOAD_PAGE_SIZE, POOR_WEEK_MIN_BETS } from "./config";
import { matchLabel } from "./format";
import { recentlyFeatured } from "./history";
import type { PopupBetRow, PopupUserRow, WeekData } from "./types";

// Lecture des données d'une semaine pour la génération (plan §3.2).
// service_role : la RLS ne laisse pas lire les paris des autres.
//
// Fenêtre [lundi précédent 10h, lundi 10h) Paris. WON et LOST sont bornés par
// `resolved_at` (JAMAIS `scored_at` : réécrit par recomputeBet), REJECTED par
// `rejected_at` (posé par trigger, PR 1). lib/recaps/load.ts n'est pas
// réutilisable (il filtre sur scored_at).

type Client = ReturnType<typeof getServiceClient>;

const MIGRATION_HINT = "migration 20261013090000 poussée ?";

/** Identifiants par `.in()` : 100 uuid restent largement sous la limite d'URL. */
const ID_CHUNK = 100;

function fail(context: string, error: { message: string }): never {
  // Le message PostgREST ne porte aucune donnée de joueur.
  throw new Error(`${context} (${MIGRATION_HINT}) : ${error.message}`);
}

const BET_COLUMNS = [
  "id",
  "user_id",
  "description",
  "status",
  "scope",
  "match_id",
  "series_id",
  "validated_difficulty",
  "calculated_proba",
  "resolved_at",
  "rejected_at",
  "resolution_reason",
  "resolved_by_admin_id",
  "is_admin_corrected",
  "structured_stat",
  "structured_threshold",
  "structured_comparison",
  "structured_negation",
  "structured_team_id",
  "structured_player_id",
  "structured_period",
  "structured_technical_fouls_count",
  "structured_duel",
  "structured_combo",
  "structured_roster_split",
  "structured_roster_count",
  "structured_superlative",
  "structured_last_basket",
  "structured_block_on_player",
].join(", ");

/** Les colonnes `numeric` reviennent parfois en chaîne. */
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function coerceBet(row: Record<string, unknown>): PopupBetRow {
  const bet = row as unknown as PopupBetRow;
  return {
    ...bet,
    validated_difficulty: toNumber(row.validated_difficulty),
    calculated_proba: toNumber(row.calculated_proba),
    structured_threshold: toNumber(row.structured_threshold),
  };
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export async function loadWeekData(
  competitionId: string,
  weekEnd: string,
  deps: { client?: Client } = {},
): Promise<WeekData> {
  const supabase = deps.client ?? getServiceClient();
  const startIso = recapBoundaryIso(addDays(weekEnd, -7));
  const endIso = recapBoundaryIso(weekEnd);

  // 1. Niveau 1 de semaine pauvre : comptage avant toute exclusion.
  const settled = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .in("status", ["WON", "LOST"])
    .gte("resolved_at", startIso)
    .lt("resolved_at", endIso);
  if (settled.error) fail("Lecture des paris résolus de la semaine", settled.error);
  const refused = await supabase
    .from("bets")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("status", "REJECTED")
    .gte("rejected_at", startIso)
    .lt("rejected_at", endIso);
  if (refused.error) fail("Lecture des paris refusés de la semaine", refused.error);
  const rawCount = (settled.count ?? 0) + (refused.count ?? 0);

  // 2. Paris (seulement si la semaine n'est pas pauvre), paginés : PostgREST
  //    plafonne une réponse à 1 000 lignes.
  const bets: PopupBetRow[] = [];
  let truncated = false;
  if (rawCount >= POOR_WEEK_MIN_BETS) {
    const readAll = async (
      context: string,
      page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
    ) => {
      for (let offset = 0; ; offset += LOAD_PAGE_SIZE) {
        if (bets.length >= LOAD_MAX_ROWS) {
          truncated = true;
          return;
        }
        const { data, error } = await page(offset, offset + LOAD_PAGE_SIZE - 1);
        if (error) fail(context, error);
        const rows = (data ?? []) as Record<string, unknown>[];
        for (const row of rows) bets.push(coerceBet(row));
        if (rows.length < LOAD_PAGE_SIZE) return;
      }
    };
    await readAll("Lecture des paris gagnés et perdus", (from, to) =>
      supabase
        .from("bets")
        .select(BET_COLUMNS)
        .eq("competition_id", competitionId)
        .in("status", ["WON", "LOST"])
        .gte("resolved_at", startIso)
        .lt("resolved_at", endIso)
        .order("resolved_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    await readAll("Lecture des paris refusés", (from, to) =>
      supabase
        .from("bets")
        .select(BET_COLUMNS)
        .eq("competition_id", competitionId)
        .eq("status", "REJECTED")
        .gte("rejected_at", startIso)
        .lt("rejected_at", endIso)
        .order("rejected_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  }

  // 3. Champions de la semaine (figés).
  const championsRes = await supabase
    .from("weekly_champions")
    .select("user_id, points")
    .eq("competition_id", competitionId)
    .eq("week_end_date", weekEnd)
    .order("user_id", { ascending: true });
  if (championsRes.error) fail("Lecture des champions de la semaine", championsRes.error);
  const champions = (championsRes.data ?? []).map((r) => ({
    userId: String(r.user_id),
    points: Number(r.points),
  }));

  // 4. Joueurs : auteurs des paris et champions.
  const userIds = [...new Set([...bets.map((b) => b.user_id), ...champions.map((c) => c.userId)])];
  const users = new Map<string, PopupUserRow>();
  for (const ids of chunk(userIds, ID_CHUNK)) {
    const { data, error } = await supabase
      .from("users")
      .select("id, pseudo, status, popup_mentions_opt_out")
      .in("id", ids);
    if (error) fail("Lecture des joueurs", error);
    for (const row of data ?? []) {
      users.set(String(row.id), {
        id: String(row.id),
        pseudo: String(row.pseudo ?? ""),
        status: String(row.status ?? ""),
        popup_mentions_opt_out: row.popup_mentions_opt_out === true,
      });
    }
  }

  // 5. Libellés de match (« BOS - NYK »), pari de série = pas de match.
  const matchIds = [
    ...new Set(bets.filter((b) => b.scope === "MATCH" && b.match_id).map((b) => b.match_id as string)),
  ];
  const matchLabels = new Map<string, string>();
  if (matchIds.length > 0) {
    const matches: { id: string; home_team_id: string | null; away_team_id: string | null }[] = [];
    for (const ids of chunk(matchIds, ID_CHUNK)) {
      const { data, error } = await supabase
        .from("matches")
        .select("id, home_team_id, away_team_id")
        .in("id", ids);
      if (error) fail("Lecture des matchs", error);
      matches.push(...((data ?? []) as typeof matches));
    }
    const teamIds = [
      ...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((t): t is string => !!t)),
    ];
    const abbreviation = new Map<string, string>();
    for (const ids of chunk(teamIds, ID_CHUNK)) {
      const { data, error } = await supabase.from("teams").select("id, abbreviation").in("id", ids);
      if (error) fail("Lecture des équipes", error);
      for (const t of data ?? []) abbreviation.set(String(t.id), String(t.abbreviation ?? ""));
    }
    for (const m of matches) {
      const label = matchLabel(
        m.home_team_id ? abbreviation.get(m.home_team_id) : undefined,
        m.away_team_id ? abbreviation.get(m.away_team_id) : undefined,
      );
      if (label) matchLabels.set(m.id, label);
    }
  }

  // 6. Historique (2 dernières popups publiées) et compteur de replis.
  const history = await supabase
    .from("weekly_popups")
    .select("week_end_date, status, featured_user_ids")
    .eq("competition_id", competitionId)
    .eq("status", "PUBLISHED")
    .lt("week_end_date", weekEnd)
    .order("week_end_date", { ascending: false })
    .limit(2);
  if (history.error) fail("Lecture de l'historique des popups", history.error);
  const recentlyFeaturedIds = recentlyFeatured(
    (history.data ?? []).map((r) => ({
      week_end_date: String(r.week_end_date),
      status: r.status,
      featured_user_ids: (r.featured_user_ids ?? []) as string[],
    })),
    weekEnd,
  );
  const fallbacks = await supabase
    .from("weekly_popups")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("kind", "FALLBACK")
    .eq("status", "PUBLISHED");
  if (fallbacks.error) fail("Lecture du compteur de textes de repli", fallbacks.error);

  return {
    competitionId,
    weekEnd,
    startIso,
    endIso,
    rawCount,
    bets,
    users,
    matchLabels,
    champions,
    recentlyFeaturedIds,
    publishedFallbackCount: fallbacks.count ?? 0,
    truncated,
  };
}
