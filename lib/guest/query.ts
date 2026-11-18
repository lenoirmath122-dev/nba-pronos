import { createClient } from "@supabase/supabase-js";
import { hiddenSeriesFilter } from "@/lib/queries/dailyVisibility";
import { voteSplit, SOCIAL_PROOF_MIN, type VoteSplit } from "@/lib/publicHome/select";

// Lectures du mode invité (chantier mode invité, lot A). Client anonyme SANS
// cookie : les pages qui les appellent sont mises en cache (revalidate), aucun
// getUser() (quota CPU Vercel). Seules les colonnes ouvertes à `anon` sont
// lues (voir migration 20261118090000 : users = identité publique).

export type GuestTeam = { id: string; name: string; abbreviation: string; logoUrl: string | null };
export type GuestMatch = {
  id: string;
  scheduledAt: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | string;
  home: GuestTeam;
  away: GuestTeam;
  homeScore: number | null;
  awayScore: number | null;
};

type TeamRow = { id: string; name: string; abbreviation: string; logo_url: string | null };
type MatchRow = {
  id: string;
  scheduled_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home: TeamRow | null;
  away: TeamRow | null;
};

const MATCH_COLUMNS =
  "id, scheduled_at, status, home_score, away_score, " +
  "home:teams!matches_home_team_id_fkey(id, name, abbreviation, logo_url), " +
  "away:teams!matches_away_team_id_fkey(id, name, abbreviation, logo_url)";

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Build de la CI sans variables : page pré-rendue vide (même règle que
  // lib/publicHome/query.ts).
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const toTeam = (t: TeamRow): GuestTeam => ({ id: t.id, name: t.name, abbreviation: t.abbreviation, logoUrl: t.logo_url });

export function toGuestMatch(r: MatchRow): GuestMatch | null {
  if (!r.home || !r.away || !r.scheduled_at) return null;
  return {
    id: r.id,
    scheduledAt: r.scheduled_at,
    status: r.status,
    home: toTeam(r.home),
    away: toTeam(r.away),
    homeScore: r.home_score,
    awayScore: r.away_score,
  };
}

async function activeCompetitionId(supabase: NonNullable<ReturnType<typeof anon>>): Promise<string | null> {
  const { data } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .eq("type", "DAILY_MATCH")
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export type GuestMatchList = { upcoming: GuestMatch[]; recent: GuestMatch[]; nowMs: number };

/** Matchs à venir (ou en cours) et derniers résultats de la compétition active. */
export async function getGuestMatchList(nowMs: number = Date.now()): Promise<GuestMatchList> {
  const supabase = anon();
  if (!supabase) return { upcoming: [], recent: [], nowMs };
  const competitionId = await activeCompetitionId(supabase);
  if (!competitionId) return { upcoming: [], recent: [], nowMs };

  const hidden = await hiddenSeriesFilter(supabase, nowMs);
  const sinceIso = new Date(nowMs - 12 * 3600_000).toISOString();
  const [{ data: up }, { data: done }] = await Promise.all([
    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("competition_id", competitionId)
      .in("status", ["SCHEDULED", "IN_PROGRESS"])
      .gte("scheduled_at", sinceIso)
      .not("series_id", "in", hidden)
      .order("scheduled_at", { ascending: true })
      .limit(30)
      .returns<MatchRow[]>(),
    supabase
      .from("matches")
      .select(MATCH_COLUMNS)
      .eq("competition_id", competitionId)
      .eq("status", "FINISHED")
      .order("scheduled_at", { ascending: false })
      .limit(10)
      .returns<MatchRow[]>(),
  ]);
  const keep = (rows: MatchRow[] | null) => (rows ?? []).map(toGuestMatch).filter((m): m is GuestMatch => m !== null);
  return { upcoming: keep(up), recent: keep(done), nowMs };
}

export type GuestMatchDetail = {
  nowMs: number;
  match: GuestMatch;
  split: NonNullable<VoteSplit> | null;
  /** null sous SOCIAL_PROOF_MIN.resultPlayers pronos. */
  resultStats: { total: number; correctWinners: number; exactPseudo: string | null } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un match par id (null si inconnu, masqué ou id invalide). */
export async function getGuestMatch(id: string, nowMs: number = Date.now()): Promise<GuestMatchDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = anon();
  if (!supabase) return null;

  const hidden = await hiddenSeriesFilter(supabase, nowMs);
  const { data: row } = await supabase
    .from("matches")
    .select(MATCH_COLUMNS)
    .eq("id", id)
    .not("series_id", "in", hidden)
    .maybeSingle<MatchRow>();
  const match = row ? toGuestMatch(row) : null;
  if (!match) return null;

  if (match.status === "FINISHED") {
    const { data } = await supabase.rpc("home_match_result_stats", { p_match_id: id });
    const stat = (data as { total: number; correct_winners: number; exact_pseudo: string | null }[] | null)?.[0];
    const resultStats =
      stat && stat.total >= SOCIAL_PROOF_MIN.resultPlayers
        ? { total: stat.total, correctWinners: stat.correct_winners, exactPseudo: stat.exact_pseudo }
        : null;
    return { nowMs, match, split: null, resultStats };
  }

  const { data } = await supabase.rpc("home_match_vote_counts", { p_match_ids: [id] });
  const c = ((data ?? []) as { match_id: string; total: number; home_votes: number }[])[0];
  return { nowMs, match, split: c ? voteSplit(c.total, c.home_votes) : null, resultStats: null };
}

export type GuestChatMessage = { id: string; userId: string; pseudo: string; avatarUrl: string | null; body: string; createdAt: string };

const GUEST_CHAT_LIMIT = 50;

/** Derniers messages du canal Général, lecture seule (le plus récent en dernier). */
export async function getGuestChatMessages(): Promise<GuestChatMessage[]> {
  const supabase = anon();
  if (!supabase) return [];
  const { data: rows } = await supabase
    .from("chat_messages")
    .select("id, user_id, body, created_at")
    .eq("scope_type", "GLOBAL")
    .order("created_at", { ascending: false })
    .limit(GUEST_CHAT_LIMIT);
  const messages = (rows ?? []) as { id: string; user_id: string; body: string; created_at: string }[];
  if (messages.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, pseudo, avatar_url")
    .in("id", [...new Set(messages.map((m) => m.user_id))]);
  const byId = new Map((users ?? []).map((u) => [u.id as string, u as { id: string; pseudo: string; avatar_url: string | null }]));

  return messages
    .slice()
    .reverse()
    .map((m) => ({
      id: m.id,
      userId: m.user_id,
      pseudo: byId.get(m.user_id)?.pseudo ?? "Joueur",
      avatarUrl: byId.get(m.user_id)?.avatar_url ?? null,
      body: m.body,
      createdAt: m.created_at,
    }));
}
