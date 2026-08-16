import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Lecture de la file de validation admin (SPEC_ECRAN_ADMIN_VALIDATION_V0_1
// §1/§2). Même construction de libellés que lib/queries/my-bets.ts, élargie
// à TOUS les joueurs de la compétition active (pas seulement auth.uid()) —
// RLS bets_select (is_admin() y donne accès à toutes les lignes).

export type PendingValidationBet = {
  betId: string;
  playerUserId: string; // ajouté le 30/07/2026, lien /players/[userId]
  playerPseudo: string;
  targetLabel: string;
  description: string;
  proposedCategory: BetCategory;
  proposedDifficulty: BetDifficulty;
  submittedAt: string;
};

function matchLabel(gameNumber: number, scheduledAt: string | null): string {
  if (!scheduledAt) return `Match ${gameNumber} — date à confirmer`;
  return `Match ${gameNumber} — ${parisDateTimeLabel(scheduledAt)}`;
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
  proposed_category: BetCategory;
  proposed_difficulty: BetDifficulty;
  submitted_at: string | null;
};

type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };
type MatchRow = { id: string; game_number: number; scheduled_at: string | null };

export async function getPendingValidationBets(): Promise<PendingValidationBet[]> {
  const supabase = await getServerClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return [];

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, user_id, scope, series_id, match_id, description, proposed_category, proposed_difficulty, submitted_at")
    .eq("competition_id", competition.id)
    .eq("status", "SUBMITTED")
    .order("submitted_at", { ascending: true });

  const bets = (betsData ?? []) as BetRow[];
  if (bets.length === 0) return [];

  const userIds = [...new Set(bets.map((b) => b.user_id))];
  const seriesIds = [...new Set(bets.map((b) => b.series_id))];
  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];

  const [{ data: usersData }, { data: seriesData }, { data: matchesData }] = await Promise.all([
    supabase.from("users").select("id, pseudo").in("id", userIds),
    supabase.from("series").select("id, round, team1_id, team2_id").in("id", seriesIds),
    matchIds.length > 0
      ? supabase.from("matches").select("id, game_number, scheduled_at").in("id", matchIds)
      : Promise.resolve({ data: [] as MatchRow[] }),
  ]);

  const pseudoById = new Map((usersData ?? []).map((u) => [u.id as string, u.pseudo as string]));
  const series = (seriesData ?? []) as SeriesRow[];
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const matchById = new Map(((matchesData ?? []) as MatchRow[]).map((m) => [m.id, m]));

  const teamIds = [...new Set(series.flatMap((s) => [s.team1_id, s.team2_id]).filter((id): id is string => id !== null))];
  const { data: teamsData } =
    teamIds.length > 0
      ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds)
      : { data: [] as { id: string; abbreviation: string }[] };
  const abbrevById = new Map((teamsData ?? []).map((t) => [t.id, t.abbreviation]));

  return bets.map((b) => {
    const s = seriesById.get(b.series_id);
    const m = b.match_id ? matchById.get(b.match_id) : null;
    const targetLabel = b.scope === "MATCH" && m ? matchLabel(m.game_number, m.scheduled_at) : s ? seriesLabel(s, abbrevById) : "—";

    return {
      betId: b.id,
      playerUserId: b.user_id,
      playerPseudo: pseudoById.get(b.user_id) ?? "—",
      targetLabel,
      description: b.description,
      proposedCategory: b.proposed_category,
      proposedDifficulty: b.proposed_difficulty,
      submittedAt: b.submitted_at ?? "",
    };
  });
}
