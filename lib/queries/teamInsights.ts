import "server-only";
import { unstable_cache } from "next/cache";
import { getServiceClient } from "@/lib/supabase/service";
import { getAllTeams } from "@/lib/queries/teams";
import { buildTeamInsights, toTeamFormSummary, type PlayerSeasonRow, type TeamFormRow } from "@/lib/teamInsights/build";
import type { TeamFormSummary, TeamInsightsResponse } from "@/lib/teamInsights/types";

// Lecture de l'aide aux débutants (CHANTIER_AIDE_DEBUTANTS.md §7.2). Client
// service : stats_team_form / stats_player_season sont fermées par la RLS (sans
// policy) et ne contiennent que des stats NBA publiques. Cache Next étiqueté
// « team-insights », invalidé par /api/revalidate/team-insights après chaque
// rafraîchissement de la VM, avec 1 h de durée de vie maximale en filet.

export const TEAM_INSIGHTS_TAG = "team-insights";
const TTL_SECONDS = 3600;

const FORM_COLUMNS =
  "team_id, tricode, conference, games_played, wins, losses, home_wins, home_losses, away_wins, away_losses, pts_for_avg, pts_against_avg, point_diff_avg, last5_results, last5_wins, last5_point_diff_avg, streak_type, streak_length, conference_rank, computed_at";
const PLAYER_COLUMNS =
  "player_id, first_name, family_name, current_team_id, games_played, games_with_current_team, games_started, minutes_avg, pts_avg, reb_avg, ast_avg, stl_avg, blk_avg, fg3m_avg, fg_pct, fg3_pct, ft_pct, ts_pct, last5_games, last5_pts_avg, computed_at";

async function latestSeason(): Promise<string | null> {
  const { data } = await getServiceClient()
    .from("stats_team_form")
    .select("season")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle<{ season: string }>();
  return data?.season ?? null;
}

async function fetchFormBySeason(): Promise<[string, TeamFormSummary][]> {
  try {
    const season = await latestSeason();
    if (!season) return [];
    const { data } = await getServiceClient().from("stats_team_form").select(FORM_COLUMNS).eq("season", season);
    return ((data ?? []) as TeamFormRow[]).map((row) => [row.tricode, toTeamFormSummary(row)]);
  } catch {
    return []; // jamais bloquant pour l'écran Jouer
  }
}

const cachedFormEntries = unstable_cache(fetchFormBySeason, ["team-form-by-season"], {
  revalidate: TTL_SECONDS,
  tags: [TEAM_INSIGHTS_TAG],
});

/** tricode → forme de la saison courante. Map vide en cas d'échec. */
export async function getTeamFormBySeason(): Promise<Map<string, TeamFormSummary>> {
  let entries: [string, TeamFormSummary][];
  try {
    entries = await cachedFormEntries();
  } catch {
    // Hors runtime Next (tests d'intégration) : unstable_cache sans incrementalCache.
    entries = await fetchFormBySeason();
  }
  return new Map(entries);
}

async function fetchInsights(teamIds: string[]): Promise<TeamInsightsResponse> {
  const allTeams = await getAllTeams();
  const byId = new Map(allTeams.map((t) => [t.id, t]));
  const requested = teamIds.map((id) => byId.get(id));
  const tricodes = requested.flatMap((t) => (t ? [t.abbreviation] : []));
  const season = await latestSeason();

  let formRows: TeamFormRow[] = [];
  let playerRows: PlayerSeasonRow[] = [];
  if (season && tricodes.length > 0) {
    const client = getServiceClient();
    const { data: forms } = await client
      .from("stats_team_form")
      .select(FORM_COLUMNS)
      .eq("season", season)
      .in("tricode", tricodes);
    formRows = (forms ?? []) as TeamFormRow[];
    const statTeamIds = formRows.map((r) => r.team_id);
    if (statTeamIds.length > 0) {
      const { data: players } = await client
        .from("stats_player_season")
        .select(PLAYER_COLUMNS)
        .eq("season", season)
        .in("current_team_id", statTeamIds);
      playerRows = (players ?? []) as PlayerSeasonRow[];
    }
  }

  const formByTricode = new Map(formRows.map((r) => [r.tricode, r]));
  const teams = teamIds.map((id, i) => {
    // uuid inconnu : réponse vide plutôt qu'une erreur.
    const ref = requested[i] ?? { id, abbreviation: "" };
    return buildTeamInsights(ref, formByTricode.get(ref.abbreviation), playerRows);
  });
  const stamps = [...formRows, ...playerRows].map((r) => r.computed_at).filter((s): s is string => Boolean(s));
  const updatedAt = stamps.length > 0 ? stamps.reduce((a, b) => (a > b ? a : b)) : null;
  return { season, updatedAt, teams };
}

const cachedInsights = unstable_cache(fetchInsights, ["team-insights-pair"], {
  revalidate: TTL_SECONDS,
  tags: [TEAM_INSIGHTS_TAG],
});

/** Détails d'une ou deux équipes (uuid `teams.id`), dans l'ordre demandé. */
export async function getTeamInsights(teamIds: string[]): Promise<TeamInsightsResponse> {
  try {
    return await cachedInsights(teamIds);
  } catch {
    return fetchInsights(teamIds);
  }
}
