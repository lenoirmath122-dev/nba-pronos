import { getServiceClient } from "@/lib/supabase/service";
import { nyDateString } from "@/lib/dates/newyork";
import { normalizeNbaGame, orientToApp, type NbaLivePayload } from "@/lib/nba/nbaLive";
import { applyMatchResult, hasResultChanged, isStatusRegression, type MatchRow } from "@/lib/sync/results";

// Writer de /api/sync/results-nba : résultats poussés par la VM depuis l'API
// NBA (scoreboard live). Même écriture que Highlightly (applyMatchResult) ;
// seule la SOURCE change. Le rapprochement match de l'app <-> match NBA est
// déterministe : même jour NY + même paire de tricodes (teams.abbreviation
// porte déjà les tricodes NBA). Pas de tolérance ±1 jour : en séries, le risque
// de prendre le mauvais match est trop grand. Le mapping est mis en cache dans
// entity_mappings (source_type NBA_LIVE — distinct de NBA_API qui signifie
// « box score importé » pour les resolvers) et survit à un report de match.

export type SkippedNbaGame = { gameId: string; reason: string };

export type DryRunDiff = { gameId: string; matchId: string; from: string; to: string };

export type SyncResultsNbaResult = {
  changed: number;
  unchanged: number;
  /** Matchs NBA sans équivalent dans l'app (cas normal : Match du jour, adversaires étrangers en présaison). */
  unmapped: number;
  skipped: SkippedNbaGame[];
  finishedNow: string[];
  dryRun: boolean;
  dryRunDiffs: DryRunDiff[];
  noActiveCompetition: boolean;
};

type CandidateRow = MatchRow & {
  scheduled_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
};

const MATCH_COLUMNS =
  "id, series_id, status, home_score, away_score, went_to_ot, quarter_scores, scheduled_at, home_team_id, away_team_id, series!inner(competition_id)";
const WINDOW_MS = 3 * 24 * 3600 * 1000;

export async function syncResultsFromNba(payload: NbaLivePayload): Promise<SyncResultsNbaResult> {
  const supabase = getServiceClient();
  const dryRun = payload.dryRun === true;
  const result: SyncResultsNbaResult = {
    changed: 0,
    unchanged: 0,
    unmapped: 0,
    skipped: [],
    finishedNow: [],
    dryRun,
    dryRunDiffs: [],
    noActiveCompetition: false,
  };
  if (payload.games.length === 0) return result;

  // Toute erreur Supabase est LEVÉE (la route répond 502 + sync_log) : sinon une
  // panne partielle ferait passer tous les matchs pour « non mappés », en silence.
  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();
  if (competitionError) throw new Error(`competitions : ${competitionError.message}`);
  if (!competition) {
    result.noActiveCompetition = true;
    return result;
  }

  // Doublon de gameId dans le corps : on garde la dernière occurrence.
  const uniqueGames = [...new Map(payload.games.map((g) => [g.gameId, g])).values()];
  const normalized = [];
  for (const game of uniqueGames) {
    const n = normalizeNbaGame(game);
    if (n.ok) normalized.push(n.game);
    else result.skipped.push({ gameId: n.gameId, reason: n.reason });
  }
  if (normalized.length === 0) return result;

  const gameIds = normalized.map((g) => g.gameId);
  const times = normalized.map((g) => Date.parse(g.gameTimeUTC));
  const from = new Date(Math.min(...times) - WINDOW_MS).toISOString();
  const to = new Date(Math.max(...times) + WINDOW_MS).toISOString();

  const [cacheRes, teamsRes, windowRes] = await Promise.all([
    supabase.from("entity_mappings").select("internal_id, source_ref").eq("entity_type", "MATCH").eq("source_type", "NBA_LIVE").in("source_ref", gameIds),
    supabase.from("teams").select("id, abbreviation"),
    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("series.competition_id", competition.id)
      .neq("status", "CANCELLED")
      .gte("scheduled_at", from)
      .lte("scheduled_at", to),
  ]);

  for (const [name, res] of [["entity_mappings", cacheRes], ["teams", teamsRes], ["matches", windowRes]] as const) {
    if (res.error) throw new Error(`${name} : ${res.error.message}`);
  }
  const { data: cacheData } = cacheRes;
  const { data: teamsData } = teamsRes;
  const { data: windowData } = windowRes;

  const abbreviationByTeamId = new Map<string, string>((teamsData ?? []).map((t) => [t.id as string, t.abbreviation as string]));
  const cachedInternalId = new Map<string, string>((cacheData ?? []).map((r) => [r.source_ref as string, r.internal_id as string]));
  const rowById = new Map<string, CandidateRow>((windowData ?? []).map((r) => [r.id as string, r as unknown as CandidateRow]));

  // Un match mappé en cache mais hors fenêtre (report) : on le relit par id,
  // toujours restreint à la compétition ACTIVE.
  const missingIds = [...cachedInternalId.values()].filter((id) => !rowById.has(id));
  if (missingIds.length > 0) {
    const { data, error } = await supabase.from("matches").select(MATCH_COLUMNS).eq("series.competition_id", competition.id).in("id", missingIds);
    if (error) throw new Error(`matches (cache) : ${error.message}`);
    for (const r of data ?? []) rowById.set(r.id as string, r as unknown as CandidateRow);
  }

  const candidates = [...rowById.values()];
  const pairKey = (a: string, b: string) => [a, b].sort().join("-");
  const appPairKey = (c: CandidateRow) => {
    const home = c.home_team_id ? abbreviationByTeamId.get(c.home_team_id) : undefined;
    const away = c.away_team_id ? abbreviationByTeamId.get(c.away_team_id) : undefined;
    return home && away ? pairKey(home, away) : null;
  };

  for (const game of normalized) {
    let row: CandidateRow | undefined;
    const cachedId = cachedInternalId.get(game.gameId);
    if (cachedId) {
      row = rowById.get(cachedId);
      if (!row) {
        result.skipped.push({ gameId: game.gameId, reason: "match en cache hors compétition active" });
        continue;
      }
      // Un mapping faux ou obsolète ne doit jamais inverser/écrire un autre match.
      if (appPairKey(row) !== pairKey(game.homeTricode, game.awayTricode)) {
        result.skipped.push({ gameId: game.gameId, reason: "mapping en cache incohérent avec les équipes du match" });
        continue;
      }
    } else {
      const day = nyDateString(new Date(game.gameTimeUTC));
      const key = pairKey(game.homeTricode, game.awayTricode);
      const found = candidates.filter((c) => !!c.scheduled_at && nyDateString(new Date(c.scheduled_at)) === day && appPairKey(c) === key);
      if (found.length === 0) {
        result.unmapped++;
        continue;
      }
      if (found.length > 1) {
        result.skipped.push({ gameId: game.gameId, reason: "rapprochement ambigu (plusieurs matchs candidats)" });
        continue;
      }
      row = found[0];
      if (!dryRun) {
        const { error: mappingError } = await supabase.from("entity_mappings").upsert(
          {
            entity_type: "MATCH",
            internal_id: row.id,
            source_type: "NBA_LIVE",
            source_ref: game.gameId,
            status: "CONFIRMED",
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: "entity_type,internal_id,source_type" }
        );
        if (mappingError) {
          result.skipped.push({ gameId: game.gameId, reason: `échec du mapping : ${mappingError.message}` });
          continue;
        }
      }
    }

    const appHomeTricode = row.home_team_id ? abbreviationByTeamId.get(row.home_team_id) : undefined;
    if (!appHomeTricode) {
      result.skipped.push({ gameId: game.gameId, reason: "équipe domicile de l'app sans abréviation" });
      continue;
    }
    const next = orientToApp(game, appHomeTricode);

    if (dryRun) {
      if (hasResultChanged(row, next) && !isStatusRegression(row.status, next.status)) {
        result.changed++;
        result.dryRunDiffs.push({ gameId: game.gameId, matchId: row.id, from: row.status, to: next.status });
      } else {
        result.unchanged++;
      }
      continue;
    }

    const applied = await applyMatchResult(supabase, row, next);
    switch (applied.outcome) {
      case "unchanged":
        result.unchanged++;
        break;
      case "changed":
        result.changed++;
        if (applied.finishedNow) result.finishedNow.push(row.id);
        break;
      case "regression":
        result.skipped.push({ gameId: game.gameId, reason: `régression de statut refusée (${row.status} -> ${next.status})` });
        break;
      case "concurrent":
        result.skipped.push({ gameId: game.gameId, reason: "écriture concurrente, repris au prochain passage" });
        break;
      case "failed":
        result.skipped.push({ gameId: game.gameId, reason: `échec update : ${applied.message}` });
        break;
    }
  }

  return result;
}
