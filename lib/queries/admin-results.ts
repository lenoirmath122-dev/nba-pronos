import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import type { TeamRef } from "@/lib/queries/matches";

// Lecture de l'écran Saisie des résultats (SPEC_ECRAN_ADMIN_RESULTATS_V0_1
// §1/§2). Session admin (getServerClient) — series_select/matches_select
// sont déjà ouvertes à tout le monde (RLS), rien de privilégié à lire ici,
// aucune confidentialité à respecter (contrairement à lib/queries/bracket.ts,
// qui cache groups/players avant la deadline pour un JOUEUR).

export type AdminMatchRow = {
  id: string;
  gameNumber: number;
  scheduledAt: string | null;
  status: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  homeScore: number | null;
  awayScore: number | null;
};

export type AdminSeriesNode = {
  id: string;
  round: string;
  conference: "EAST" | "WEST" | null;
  slotIndex: number;
  team1: TeamRef | null;
  team2: TeamRef | null;
  officialStatus: "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
  officialWinner: TeamRef | null;
  matches: AdminMatchRow[];
};

export type AdminResultsRound = { key: string; label: string; nodes: AdminSeriesNode[] };

export type AdminResultsData = {
  competitionId: string | null;
  rounds: AdminResultsRound[];
};

const PLAYOFFS_ROUNDS = ["ROUND_1", "CONF_SEMIS", "CONF_FINALS", "NBA_FINALS"] as const;
const CUP_ROUNDS = ["CUP_QUARTERS", "CUP_SEMIS", "CUP_FINAL"] as const;
const CONFERENCE_RANK: Record<string, number> = { EAST: 0, WEST: 1 };

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };

type SeriesRow = {
  id: string;
  round: string;
  conference: "EAST" | "WEST" | null;
  slot_index: number;
  team1_id: string | null;
  team2_id: string | null;
  official_status: AdminSeriesNode["officialStatus"];
  official_winner_team_id: string | null;
};

type MatchRow = {
  id: string;
  series_id: string;
  game_number: number;
  scheduled_at: string | null;
  status: AdminMatchRow["status"];
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

export async function getAdminResultsData(): Promise<AdminResultsData> {
  const supabase = await getServerClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return { competitionId: null, rounds: [] };

  const { data: seriesData } = await supabase
    .from("series")
    .select("id, round, conference, slot_index, team1_id, team2_id, official_status, official_winner_team_id")
    .eq("competition_id", competition.id);
  const seriesRows = (seriesData ?? []) as SeriesRow[];
  if (seriesRows.length === 0) return { competitionId: competition.id, rounds: [] };

  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, series_id, game_number, scheduled_at, status, home_team_id, away_team_id, home_score, away_score")
    .eq("competition_id", competition.id)
    .order("game_number");
  const matchRows = (matchesData ?? []) as MatchRow[];

  const teamIds = new Set<string>();
  for (const s of seriesRows) {
    if (s.team1_id) teamIds.add(s.team1_id);
    if (s.team2_id) teamIds.add(s.team2_id);
    if (s.official_winner_team_id) teamIds.add(s.official_winner_team_id);
  }
  for (const m of matchRows) {
    if (m.home_team_id) teamIds.add(m.home_team_id);
    if (m.away_team_id) teamIds.add(m.away_team_id);
  }

  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, abbreviation, name")
    .in("id", Array.from(teamIds));
  const teamsById = new Map<string, TeamRef>((teamsData ?? []).map((t) => [t.id, t as TeamRef]));

  const matchesBySeriesId = new Map<string, AdminMatchRow[]>();
  for (const m of matchRows) {
    const homeTeam = m.home_team_id ? teamsById.get(m.home_team_id) : undefined;
    const awayTeam = m.away_team_id ? teamsById.get(m.away_team_id) : undefined;
    if (!homeTeam || !awayTeam) continue;
    const list = matchesBySeriesId.get(m.series_id) ?? [];
    list.push({
      id: m.id,
      gameNumber: m.game_number,
      scheduledAt: m.scheduled_at,
      status: m.status,
      homeTeam,
      awayTeam,
      homeScore: m.home_score,
      awayScore: m.away_score,
    });
    matchesBySeriesId.set(m.series_id, list);
  }

  const nodes: AdminSeriesNode[] = seriesRows.map((s) => ({
    id: s.id,
    round: s.round,
    conference: s.conference,
    slotIndex: s.slot_index,
    team1: s.team1_id ? (teamsById.get(s.team1_id) ?? null) : null,
    team2: s.team2_id ? (teamsById.get(s.team2_id) ?? null) : null,
    officialStatus: s.official_status,
    officialWinner: s.official_winner_team_id ? (teamsById.get(s.official_winner_team_id) ?? null) : null,
    matches: matchesBySeriesId.get(s.id) ?? [],
  }));

  const roundOrder = competition.type === "PLAYOFFS" ? PLAYOFFS_ROUNDS : CUP_ROUNDS;
  const rounds: AdminResultsRound[] = roundOrder
    .map((roundKey) => ({
      key: roundKey,
      label: ROUND_LABELS[roundKey] ?? roundKey,
      nodes: nodes
        .filter((n) => n.round === roundKey)
        .sort((a, b) => {
          const confDiff = CONFERENCE_RANK[a.conference ?? ""] - CONFERENCE_RANK[b.conference ?? ""];
          return confDiff !== 0 ? confDiff : a.slotIndex - b.slotIndex;
        }),
    }))
    .filter((r) => r.nodes.length > 0);

  return { competitionId: competition.id, rounds };
}
