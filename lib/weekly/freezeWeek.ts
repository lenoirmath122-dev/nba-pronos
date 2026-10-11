import { getServiceClient } from "@/lib/supabase/service";
import { addDays } from "@/lib/recaps/period";
import {
  computeWeeklyStandings,
  pickWeeklyChampions,
  resolveWeekBounds,
  weekEndFor,
  type WeeklySnapshotRow,
} from "./standings";

// Figement hebdomadaire du classement (lot 1). Appelé par /api/recaps après le
// snapshot quotidien (cron Vercel) et par le bouton admin. Idempotent : une
// semaine figée n'est jamais recalculée ; `freeze_weekly_ranking` tranche en
// base si deux appels arrivent en même temps. Ne fait rien tant que
// `competitions.weekly_ranking` est faux.
//
// Dette connue : une date de snapshot est lue en une requête (limite de 1000
// lignes PostgREST), sans risque aux volumes actuels.

export type WeeklyFreezeResult = {
  frozen: boolean;
  weekEnd?: string;
  startSnapshotDate?: string;
  endSnapshotDate?: string;
  champions?: number;
  tiebreakAvailable?: boolean;
  /** Fin prise sur un snapshot postérieur au lundi (rattrapage). */
  endLate?: boolean;
  /** Départ pris sur un snapshot antérieur au lundi n-1. */
  baselineLate?: boolean;
  skipped?:
    | "aucune compétition active"
    | "classement hebdo désactivé"
    | "déjà figé"
    | "snapshot de fin absent"
    | "première semaine (pas de snapshot de référence)"
    | "départ postérieur ou égal à la fin"
    | "départ trop ancien (à figer depuis l'admin)";
};

const MIGRATION_HINT = "migration 20261012090000 poussée ?";

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context} (${MIGRATION_HINT}) : ${error.message}`);
}

export async function runWeeklyFreeze(
  nowMs: number = Date.now(),
  options: { frozenBy?: "CRON" | "ADMIN" } = {},
): Promise<WeeklyFreezeResult> {
  const frozenBy = options.frozenBy ?? "CRON";
  const weekEnd = weekEndFor(nowMs);
  const previousWeekEnd = addDays(weekEnd, -7);
  const supabase = getServiceClient();

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id, weekly_ranking")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; weekly_ranking: boolean }>();
  if (competitionError) fail("Lecture de la compétition", competitionError);
  if (!competition) return { frozen: false, weekEnd, skipped: "aucune compétition active" };
  if (!competition.weekly_ranking) return { frozen: false, weekEnd, skipped: "classement hebdo désactivé" };

  const { data: headers, error: headersError } = await supabase
    .from("weekly_rankings")
    .select("week_end_date, end_snapshot_date")
    .eq("competition_id", competition.id)
    .in("week_end_date", [weekEnd, previousWeekEnd]);
  if (headersError) fail("Lecture des semaines figées", headersError);

  const headerRows = (headers ?? []) as { week_end_date: string; end_snapshot_date: string }[];
  if (headerRows.some((header) => header.week_end_date === weekEnd)) {
    return { frozen: false, weekEnd, skipped: "déjà figé" };
  }
  const previousFreezeEndDate =
    headerRows.find((header) => header.week_end_date === previousWeekEnd)?.end_snapshot_date ?? null;

  const [{ data: after, error: afterError }, { data: before, error: beforeError }] = await Promise.all([
    supabase
      .from("leaderboard_snapshots")
      .select("snapshot_date")
      .eq("competition_id", competition.id)
      .gte("snapshot_date", weekEnd)
      .order("snapshot_date", { ascending: true })
      .limit(1),
    supabase
      .from("leaderboard_snapshots")
      .select("snapshot_date")
      .eq("competition_id", competition.id)
      .lte("snapshot_date", previousWeekEnd)
      .order("snapshot_date", { ascending: false })
      .limit(1),
  ]);
  if (afterError) fail("Lecture du snapshot de fin", afterError);
  if (beforeError) fail("Lecture du snapshot de départ", beforeError);

  const bounds = resolveWeekBounds({
    weekEnd,
    earliestOnOrAfterEnd: (after?.[0] as { snapshot_date: string } | undefined)?.snapshot_date ?? null,
    previousFreezeEndDate,
    latestOnOrBeforeStart: (before?.[0] as { snapshot_date: string } | undefined)?.snapshot_date ?? null,
  });
  if (!bounds.ok) return { frozen: false, weekEnd, skipped: bounds.reason };
  // Départ plus ancien que le lundi n-1 (cron en panne, activation tardive) :
  // les points de plusieurs semaines seraient comptés d'un coup et le champion
  // est irréversible. Le cron ne tranche pas, le bouton admin oui.
  if (bounds.baselineLate && frozenBy === "CRON") {
    return { frozen: false, weekEnd, skipped: "départ trop ancien (à figer depuis l'admin)" };
  }

  const loadRows = async (date: string): Promise<WeeklySnapshotRow[]> => {
    const { data, error } = await supabase
      .from("leaderboard_snapshots")
      .select("user_id, total_points, correct_match_winners, exact_margins")
      .eq("competition_id", competition.id)
      .eq("snapshot_date", date);
    if (error) fail(`Lecture du snapshot du ${date}`, error);
    return (data ?? []) as WeeklySnapshotRow[];
  };
  const [startRows, endRows] = await Promise.all([loadRows(bounds.start), loadRows(bounds.end)]);

  const { standings, tiebreakAvailable } = computeWeeklyStandings(startRows, endRows);
  const champions = pickWeeklyChampions(standings);

  const { data: created, error: rpcError } = await supabase.rpc("freeze_weekly_ranking", {
    p_competition_id: competition.id,
    p_week_end_date: weekEnd,
    p_start_snapshot_date: bounds.start,
    p_end_snapshot_date: bounds.end,
    p_tiebreak_available: tiebreakAvailable,
    p_frozen_by: frozenBy,
    p_champions: champions.map((champion) => ({
      user_id: champion.userId,
      points: champion.points,
      correct_match_winners: champion.correctMatchWinners,
      exact_margins: champion.exactMargins,
    })),
  });
  if (rpcError) fail("Figement de la semaine", rpcError);
  if (created === false) return { frozen: false, weekEnd, skipped: "déjà figé" };

  return {
    frozen: true,
    weekEnd,
    startSnapshotDate: bounds.start,
    endSnapshotDate: bounds.end,
    champions: champions.length,
    tiebreakAvailable,
    ...(bounds.endLate ? { endLate: true } : {}),
    ...(bounds.baselineLate ? { baselineLate: true } : {}),
  };
}
