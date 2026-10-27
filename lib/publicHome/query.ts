import { createClient } from "@supabase/supabase-js";
import { hiddenSeriesFilter } from "@/lib/queries/dailyVisibility";
import { matchKicker } from "./labels";
import { selectHomeMatches, voteSplit, SOCIAL_PROOF_MIN, type HomeMatchRow, type VoteSplit } from "./select";

// Lectures de l'accueil public (plan d'attractivité, §1.7). Client anonyme sans
// cookie : la page peut être mise en cache (revalidate = 60). Tables lues sous
// RLS (matches, teams, competitions, users, vue user_scores : lecture ouverte) ;
// les totaux de pronos passent par des fonctions SECURITY DEFINER qui ne
// renvoient jamais de prono individuel.

export type HomeTeam = { id: string; name: string; abbreviation: string; logoUrl: string | null };

export type HomeMatch = {
  id: string;
  competitionId: string;
  scheduledAt: string;
  status: HomeMatchRow["status"];
  home: HomeTeam;
  away: HomeTeam;
  homeScore: number | null;
  awayScore: number | null;
};

export type LastResult = {
  match: HomeMatch;
  /** null sous SOCIAL_PROOF_MIN.resultPlayers pronos : seul le score est affiché. */
  stats: { total: number; correctWinners: number; exactPseudo: string | null } | null;
};

export type TopPlayer = { userId: string; pseudo: string; avatarUrl: string | null; points: number };

export type PublicHomeData = {
  live: HomeMatch | null;
  featured: HomeMatch | null;
  /** Surtitre du match mis en avant (« Match de cette nuit · 1h00 »). */
  featuredKicker: string | null;
  next: HomeMatch[];
  /** Répartition des votes par match (absent = sous le seuil). */
  splits: Record<string, NonNullable<VoteSplit>>;
  lastResult: LastResult | null;
  top: TopPlayer[];
};

const EMPTY: PublicHomeData = { live: null, featured: null, featuredKicker: null, next: [], splits: {}, lastResult: null, top: [] };

type TeamRow = { id: string; name: string; abbreviation: string; logo_url: string | null };
type MatchRow = HomeMatchRow & {
  competition_id: string;
  home_score: number | null;
  away_score: number | null;
  home: TeamRow | null;
  away: TeamRow | null;
};

const MATCH_COLUMNS =
  "id, competition_id, scheduled_at, status, home_score, away_score, " +
  "home:teams!matches_home_team_id_fkey(id, name, abbreviation, logo_url), " +
  "away:teams!matches_away_team_id_fkey(id, name, abbreviation, logo_url)";

const toTeam = (t: TeamRow): HomeTeam => ({ id: t.id, name: t.name, abbreviation: t.abbreviation, logoUrl: t.logo_url });

function toMatch(r: MatchRow): HomeMatch | null {
  if (!r.home || !r.away || !r.scheduled_at) return null;
  return {
    id: r.id,
    competitionId: r.competition_id,
    scheduledAt: r.scheduled_at,
    status: r.status,
    home: toTeam(r.home),
    away: toTeam(r.away),
    homeScore: r.home_score,
    awayScore: r.away_score,
  };
}

export async function getPublicHomeData(nowMs: number = Date.now()): Promise<PublicHomeData> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Une seule compétition ACTIVE à la fois (uniq_one_active_competition) : le
  // passage d'une semaine à l'autre reste donc invisible tant qu'elle existe.
  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("type", "DAILY_MATCH")
    .maybeSingle<{ id: string }>();
  if (!competition) return EMPTY;

  const hidden = await hiddenSeriesFilter(supabase, nowMs);
  const sinceIso = new Date(nowMs - 12 * 3600_000).toISOString();

  const [{ data: upcomingRows }, { data: finishedRows }, { data: scoreRows }] = await Promise.all([
    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("competition_id", competition.id)
      .in("status", ["SCHEDULED", "IN_PROGRESS"])
      .gte("scheduled_at", sinceIso)
      .not("series_id", "in", hidden)
      .order("scheduled_at", { ascending: true })
      .limit(8)
      .returns<MatchRow[]>(),
    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("competition_id", competition.id)
      .eq("status", "FINISHED")
      .order("scheduled_at", { ascending: false })
      .limit(1)
      .returns<MatchRow[]>(),
    supabase
      .from("user_scores")
      .select("user_id, total_points")
      .eq("competition_id", competition.id)
      .order("total_points", { ascending: false })
      .limit(20),
  ]);

  const sel = selectHomeMatches(upcomingRows ?? [], nowMs);
  const rowById = new Map((upcomingRows ?? []).map((r) => [r.id, r]));
  const asMatch = (r: HomeMatchRow | null) => (r ? toMatch(rowById.get(r.id)!) : null);
  const live = asMatch(sel.live);
  const featured = asMatch(sel.featured);
  const next = sel.next.map((r) => asMatch(r)).filter((m): m is HomeMatch => m !== null);

  const openIds = [featured, ...next].filter((m): m is HomeMatch => m !== null).map((m) => m.id);
  const lastMatch = finishedRows?.[0] ? toMatch(finishedRows[0]) : null;

  const [{ data: counts }, { data: resultStats }, { data: users }] = await Promise.all([
    openIds.length
      ? supabase.rpc("home_match_vote_counts", { p_match_ids: openIds })
      : Promise.resolve({ data: [] as unknown[] }),
    lastMatch ? supabase.rpc("home_match_result_stats", { p_match_id: lastMatch.id }) : Promise.resolve({ data: null }),
    scoreRows?.length
      ? supabase
          .from("users")
          .select("id, pseudo, avatar_url")
          .in(
            "id",
            scoreRows.map((s) => s.user_id as string),
          )
          .neq("status", "PENDING")
      : Promise.resolve({ data: [] as { id: string; pseudo: string; avatar_url: string | null }[] }),
  ]);

  const splits: PublicHomeData["splits"] = {};
  for (const c of (counts ?? []) as { match_id: string; total: number; home_votes: number }[]) {
    const s = voteSplit(c.total, c.home_votes);
    if (s) splits[c.match_id] = s;
  }

  const stat = (resultStats as { total: number; correct_winners: number; exact_pseudo: string | null }[] | null)?.[0];
  const lastResult: LastResult | null = lastMatch
    ? {
        match: lastMatch,
        stats:
          stat && stat.total >= SOCIAL_PROOF_MIN.resultPlayers
            ? { total: stat.total, correctWinners: stat.correct_winners, exactPseudo: stat.exact_pseudo }
            : null,
      }
    : null;

  const userById = new Map((users ?? []).map((u) => [u.id as string, u]));
  const top: TopPlayer[] = (scoreRows ?? [])
    .map((s) => {
      const u = userById.get(s.user_id as string);
      if (!u) return null;
      return {
        userId: u.id as string,
        pseudo: u.pseudo as string,
        avatarUrl: (u.avatar_url as string | null) ?? null,
        points: s.total_points as number,
      };
    })
    .filter((p): p is TopPlayer => p !== null)
    .slice(0, 5);

  const featuredKicker = featured ? matchKicker(featured.scheduledAt, nowMs) : null;

  return { live, featured, featuredKicker, next, splits, lastResult, top };
}
