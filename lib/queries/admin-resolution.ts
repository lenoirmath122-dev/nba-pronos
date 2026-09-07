import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { BET_DIFFICULTY_POINTS } from "@/lib/labels/bets";
import { computeBetDeadlines } from "@/lib/scoring/bet-deadline";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Lecture de la file de résolution admin (SPEC_ECRAN_ADMIN_RESOLUTION_V0_1
// §1/§2) — même construction de libellés que lib/queries/admin-validation.ts,
// élargie à TOUS les joueurs, filtrée sur VALIDATED + échéance dépassée.
//
// `orphan` (p1-15, feuille de route Phase 1) : un pari VALIDATED dont
// l'échéance calculée est `null` (aucun match connu pour son match/sa
// série -- lib/scoring/bet-deadline.ts) reste "toujours ouvert" côté RLS,
// PAR CONSTRUCTION -- comportement voulu tant que le calendrier n'est pas
// encore connu. Le risque réel n'est pas ce comportement (correct) mais sa
// dépendance à la fiabilité INVISIBLE de la synchro quotidienne : si un
// match censé arriver ne se synchronise jamais (bug/panne silencieuse), le
// pari correspondant ne rentre JAMAIS dans la file de résolution ci-dessus
// (filtrée sur échéance PASSÉE) ni nulle part ailleurs -- littéralement
// invisible. Rendu visible ici plutôt que résolu automatiquement : aucune
// date connue ne permet de trancher WON/LOST à la place de l'admin.

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
  validated_category: BetCategory | null;
  validated_difficulty: BetDifficulty | null;
};

type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };
type MatchRow = { id: string; game_number: number; scheduled_at: string | null };

export type ResolutionQueues = {
  due: PendingResolutionBet[]; // échéance PASSÉE -- à résoudre normalement.
  orphan: PendingResolutionBet[]; // échéance INCONNUE (null) -- à investiguer, cf. commentaire de module.
};

/** Hydrate un sous-ensemble de bets VALIDATED (déjà filtré par appelant) en
 *  PendingResolutionBet[] -- requêtes annexes (joueurs/séries/matchs/
 *  contestations/équipes) partagées par les 2 files ci-dessous. */
async function hydrateResolutionBets(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  bets: BetRow[]
): Promise<PendingResolutionBet[]> {
  if (bets.length === 0) return [];

  const userIds = [...new Set(bets.map((b) => b.user_id))];
  const seriesIds = [...new Set(bets.map((b) => b.series_id))];
  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];
  const betIds = bets.map((b) => b.id);

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

  return bets.map((b) => {
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

export async function getResolutionQueues(): Promise<ResolutionQueues> {
  const supabase = await getServerClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition) return { due: [], orphan: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select("id, user_id, scope, series_id, match_id, description, validated_category, validated_difficulty")
    .eq("competition_id", competition.id)
    .eq("status", "VALIDATED");
  const bets = (betsData ?? []) as BetRow[];
  if (bets.length === 0) return { due: [], orphan: [] };

  const deadlines = await computeBetDeadlines(
    supabase,
    bets.map((b) => ({ id: b.id, scope: b.scope, seriesId: b.series_id, matchId: b.match_id }))
  );
  const nowMs = Date.now();
  const dueBets: BetRow[] = [];
  const orphanBets: BetRow[] = [];
  for (const b of bets) {
    const deadline = deadlines.get(b.id) ?? null;
    if (deadline === null) orphanBets.push(b);
    else if (Date.parse(deadline) <= nowMs) dueBets.push(b);
  }

  const [due, orphan] = await Promise.all([
    hydrateResolutionBets(supabase, dueBets),
    hydrateResolutionBets(supabase, orphanBets),
  ]);
  return { due, orphan };
}
