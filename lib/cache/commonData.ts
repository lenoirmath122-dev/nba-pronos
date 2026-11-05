import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";
import type { CompetitionType } from "@/lib/competitions/types";

// Cache serveur des DONNÉES COMMUNES à tous les joueurs (programme, compétition
// active, séries DAILY, scores en direct, classement général). La partie
// personnelle (pronos, points, ligues) n'y passe jamais.
//
// Règles :
//  - une fonction en cache ne lit NI cookies NI session : client anon sans
//    session, uniquement sur des tables/vues que la RLS rend publiques
//    (competitions, series, matches : `using (true)` ; user_scores : vue
//    security_invoker = false, classement visible de tous) ;
//  - invalidation explicite par tag depuis les écritures (voir
//    invalidateCommonData), durée de vie maximale en filet de sécurité ;
//  - échec du cache (hors runtime Next : tests d'intégration, ou erreur de
//    lecture anon) → repli sur la lecture directe avec le client de la
//    requête, comportement identique à celui d'avant.

export const COMMON_TAGS = {
  competition: "common-competition",
  matches: "common-matches",
  series: "common-series",
  leaderboard: "common-leaderboard",
} as const;
export type CommonTag = (typeof COMMON_TAGS)[keyof typeof COMMON_TAGS];

// Durées de vie maximales (secondes). On commence court ; l'invalidation par
// tag fait la fraîcheur réelle.
export const COMMON_TTL = {
  competition: 600,
  matches: 300,
  liveScores: 60,
  series: 300,
  leaderboard: 300,
} as const;

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

function getAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Expire immédiatement les entrées portant ces tags (jamais de service
 *  périmé servi une fois : `expire: 0`, pas le « max » stale-while-revalidate).
 *  Sans effet hors runtime Next (tests unitaires des libs d'écriture). */
export function invalidateCommonData(...tags: CommonTag[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Hors contexte de requête Next : rien à invalider.
    }
  }
}

/** Toutes les lectures communes (actions admin génériques, recompute). */
export function invalidateAllCommonData(): void {
  invalidateCommonData(...(Object.values(COMMON_TAGS) as CommonTag[]));
}

// ---------------------------------------------------------------- compétition

export type ActiveCompetition = {
  id: string;
  name: string;
  type: CompetitionType;
  bracket_deadline: string | null;
};

const COMPETITION_COLUMNS = "id, name, type, bracket_deadline";

async function fetchActiveCompetition(): Promise<ActiveCompetition | null> {
  const { data, error } = await getAnonClient()
    .from("competitions")
    .select(COMPETITION_COLUMNS)
    .eq("status", "ACTIVE")
    .maybeSingle<ActiveCompetition>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

const cachedActiveCompetition = unstable_cache(fetchActiveCompetition, ["common-active-competition"], {
  revalidate: COMMON_TTL.competition,
  tags: [COMMON_TAGS.competition],
});

/** Compétition ACTIVE (une seule à la fois). Sous-ensemble de colonnes
 *  commun à toutes les pages ; l'appelant en lit ce dont il a besoin. */
export async function getActiveCompetition(supabase?: SupabaseServerClient): Promise<ActiveCompetition | null> {
  try {
    return await cachedActiveCompetition();
  } catch {
    const client = supabase ?? (await getServerClient());
    const { data } = await client
      .from("competitions")
      .select(COMPETITION_COLUMNS)
      .eq("status", "ACTIVE")
      .maybeSingle<ActiveCompetition>();
    return data ?? null;
  }
}

// --------------------------------------------------------------------- séries

export type DailySeriesRow = { id: string; slot_index: number };

async function fetchDailySeries(): Promise<DailySeriesRow[]> {
  const { data, error } = await getAnonClient().from("series").select("id, slot_index").eq("round", "DAILY");
  if (error) throw new Error(error.message);
  return (data ?? []) as DailySeriesRow[];
}

const cachedDailySeries = unstable_cache(fetchDailySeries, ["common-daily-series"], {
  revalidate: COMMON_TTL.series,
  tags: [COMMON_TAGS.series],
});

/** Séries DAILY brutes. Le filtre de publication (10h Paris) reste calculé à
 *  chaque requête avec l'heure courante, jamais mis en cache. */
export async function getDailySeriesRows(supabase: SupabaseServerClient): Promise<DailySeriesRow[]> {
  try {
    return await cachedDailySeries();
  } catch {
    const { data } = await supabase.from("series").select("id, slot_index").eq("round", "DAILY");
    return (data ?? []) as DailySeriesRow[];
  }
}

// -------------------------------------------------------------------- matchs

export type UpcomingMatchRow = {
  id: string;
  series_id: string;
  scheduled_at: string;
  home_team_id: string;
  away_team_id: string;
};

const HOUR_MS = 3_600_000;

async function fetchUpcomingMatches(competitionId: string, sinceIso: string): Promise<UpcomingMatchRow[]> {
  const { data, error } = await getAnonClient()
    .from("matches")
    .select("id, series_id, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", sinceIso)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as UpcomingMatchRow[];
}

const cachedUpcomingMatches = unstable_cache(fetchUpcomingMatches, ["common-upcoming-matches"], {
  revalidate: COMMON_TTL.matches,
  tags: [COMMON_TAGS.matches],
});

/** Matchs programmés après `nowMs`, dans l'ordre. On met en cache une fenêtre
 *  qui démarre à l'heure ronde précédente (clé d'arguments : le cache change
 *  chaque heure) puis on coupe à l'instant exact en mémoire : le résultat est
 *  identique à `.gt("scheduled_at", now)`. Le masquage des jours non publiés
 *  reste à la charge de l'appelant. */
export async function getUpcomingMatches(
  supabase: SupabaseServerClient,
  competitionId: string,
  nowMs: number
): Promise<UpcomingMatchRow[]> {
  const nowIso = new Date(nowMs).toISOString();
  const sinceIso = new Date(Math.floor(nowMs / HOUR_MS) * HOUR_MS).toISOString();
  let rows: UpcomingMatchRow[];
  try {
    rows = await cachedUpcomingMatches(competitionId, sinceIso);
  } catch {
    const { data } = await supabase
      .from("matches")
      .select("id, series_id, scheduled_at, home_team_id, away_team_id")
      .eq("competition_id", competitionId)
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true });
    return (data ?? []) as UpcomingMatchRow[];
  }
  return rows.filter((row) => row.scheduled_at > nowIso);
}

export type LiveScoreRow = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
};

async function fetchLiveScoreRows(competitionId: string): Promise<LiveScoreRow[]> {
  const { data, error } = await getAnonClient()
    .from("matches")
    .select("id, home_team_id, away_team_id, home_score, away_score")
    .eq("competition_id", competitionId)
    .eq("status", "IN_PROGRESS")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LiveScoreRow[];
}

const cachedLiveScoreRows = unstable_cache(fetchLiveScoreRows, ["common-live-scores"], {
  revalidate: COMMON_TTL.liveScores,
  tags: [COMMON_TAGS.matches],
});

export async function getLiveScoreRows(supabase: SupabaseServerClient, competitionId: string): Promise<LiveScoreRow[]> {
  try {
    return await cachedLiveScoreRows(competitionId);
  } catch {
    const { data } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score")
      .eq("competition_id", competitionId)
      .eq("status", "IN_PROGRESS")
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: false });
    return (data ?? []) as LiveScoreRow[];
  }
}

// ---------------------------------------------------------------- classement

export type UserScoreRow = {
  user_id: string;
  total_points: number;
  matches_points: number;
  bracket_points: number;
  bets_points: number;
  correct_match_winners: number;
  exact_margins: number;
  admin_corrections_count: number;
};

const SCORE_COLUMNS =
  "user_id, total_points, matches_points, bracket_points, bets_points, correct_match_winners, exact_margins, admin_corrections_count";

async function fetchUserScores(competitionId: string): Promise<UserScoreRow[]> {
  const { data, error } = await getAnonClient().from("user_scores").select(SCORE_COLUMNS).eq("competition_id", competitionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as UserScoreRow[];
}

const cachedUserScores = unstable_cache(fetchUserScores, ["common-user-scores"], {
  revalidate: COMMON_TTL.leaderboard,
  tags: [COMMON_TAGS.leaderboard],
});

/** Lignes brutes du classement général d'une compétition (vue publique). */
export async function getUserScoreRows(supabase: SupabaseServerClient, competitionId: string): Promise<UserScoreRow[]> {
  try {
    return await cachedUserScores(competitionId);
  } catch {
    const { data } = await supabase.from("user_scores").select(SCORE_COLUMNS).eq("competition_id", competitionId);
    return (data ?? []) as UserScoreRow[];
  }
}
