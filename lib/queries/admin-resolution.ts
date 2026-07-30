import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { BET_DIFFICULTY_POINTS } from "@/lib/labels/bets";
import { computeBetDeadlinesPassed } from "@/lib/scoring/bet-deadline";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Lecture de la file de résolution admin (SPEC_ECRAN_ADMIN_RESOLUTION_V0_1
// §1/§2) — même construction de libellés que lib/queries/admin-validation.ts,
// élargie à TOUS les joueurs, filtrée sur VALIDATED + échéance dépassée.

export type PendingResolutionBet = {
  betId: string;
  playerUserId: string; // ajouté le 30/07/2026, lien /players/[userId]
  playerPseudo: string;
  targetLabel: string;
  description: string;
  validatedCategory: BetCategory;
  validatedDifficulty: BetDifficulty;
  pointsAtStake: number;
  isContested: boolean; // requête de correction PENDING déjà déposée sur ce pari
};

const MATCH_LABEL_TIMEZONE = "Europe/Paris";

function matchLabel(gameNumber: number, scheduledAt: string | null): string {
  if (!scheduledAt) return `Match ${gameNumber} — date à confirmer`;
  const date = new Date(scheduledAt);
  const datePart = new Intl.DateTimeFormat("fr-FR", { timeZone: MATCH_LABEL_TIMEZONE, day: "2-digit", month: "2-digit" }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeZone: MATCH_LABEL_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `Match ${gameNumber} — ${datePart} ${timePart}`;
}

function seriesLabel(s: SeriesRow, abbrevById: Map<string, string>): string {
  const round = ROUND_LABELS[s.round] ?? s.round;
  const team1 = s.team1_id ? abbrevById.get(s.team1_id) : undefined;
  const team2 = s.team2_id ? abbrevById.get(s.team2_id) : undefined;
  return team1 && team2 ? `${round} — ${team1} vs ${team2}` : round;
}

type CompetitionRow = { id: string };

type BetRow = {
  id: string;
  user_id: string;
  scope: "SERIES" | "MATCH";
  series_id: string;
  match_id: string | null;
  description: string;
  validated_category: BetCategory | null;
  validated_difficulty: BetDifficulty | null;
};

type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };
type MatchRow = { id: string; game_number: number; scheduled_at: string | null };

export async function getPendingResolutionBets(): Promise<PendingResolutionBet[]> {
  const supabase = await getServerClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return [];

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, user_id, scope, series_id, match_id, description, validated_category, validated_difficulty")
    .eq("competition_id", competition.id)
    .eq("status", "VALIDATED");
  const bets = (betsData ?? []) as BetRow[];
  if (bets.length === 0) return [];

  const passedIds = await computeBetDeadlinesPassed(
    supabase,
    bets.map((b) => ({ id: b.id, scope: b.scope, seriesId: b.series_id, matchId: b.match_id }))
  );
  const dueBets = bets.filter((b) => passedIds.has(b.id));
  if (dueBets.length === 0) return [];

  const userIds = [...new Set(dueBets.map((b) => b.user_id))];
  const seriesIds = [...new Set(dueBets.map((b) => b.series_id))];
  const matchIds = [...new Set(dueBets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const betIds = dueBets.map((b) => b.id);

  const [{ data: usersData }, { data: seriesData }, { data: matchesData }, { data: pendingData }] = await Promise.all([
    supabase.from("users").select("id, pseudo").in("id", userIds),
    supabase.from("series").select("id, round, team1_id, team2_id").in("id", seriesIds),
    matchIds.length > 0
      ? supabase.from("matches").select("id, game_number, scheduled_at").in("id", matchIds)
      : Promise.resolve({ data: [] as MatchRow[] }),
    supabase.from("correction_requests").select("target_bet_id").eq("status", "PENDING").in("target_bet_id", betIds),
  ]);

  const pseudoById = new Map((usersData ?? []).map((u) => [u.id as string, u.pseudo as string]));
  const series = (seriesData ?? []) as SeriesRow[];
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const matchById = new Map(((matchesData ?? []) as MatchRow[]).map((m) => [m.id, m]));
  const contestedBetIds = new Set((pendingData ?? []).map((r) => r.target_bet_id as string));

  const teamIds = [...new Set(series.flatMap((s) => [s.team1_id, s.team2_id]).filter((id): id is string => id !== null))];
  const { data: teamsData } =
    teamIds.length > 0
      ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds)
      : { data: [] as { id: string; abbreviation: string }[] };
  const abbrevById = new Map((teamsData ?? []).map((t) => [t.id, t.abbreviation]));

  return dueBets.map((b) => {
    const s = seriesById.get(b.series_id);
    const m = b.match_id ? matchById.get(b.match_id) : null;
    const targetLabel = b.scope === "MATCH" && m ? matchLabel(m.game_number, m.scheduled_at) : s ? seriesLabel(s, abbrevById) : "—";
    // validated_* fait foi (§8) : toujours non-NULL ici (le pari est VALIDATED).
    const validatedCategory = (b.validated_category ?? "TEAM_PROP") as BetCategory;
    const validatedDifficulty = (b.validated_difficulty ?? 1) as BetDifficulty;

    return {
      betId: b.id,
      playerUserId: b.user_id,
      playerPseudo: pseudoById.get(b.user_id) ?? "—",
      targetLabel,
      description: b.description,
      validatedCategory,
      validatedDifficulty,
      pointsAtStake: BET_DIFFICULTY_POINTS[validatedDifficulty],
      isContested: contestedBetIds.has(b.id),
    };
  });
}
