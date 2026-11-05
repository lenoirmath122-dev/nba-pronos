import { getServerClient } from "@/lib/supabase/server";
import { resolveLeagueScope } from "@/lib/queries/leagues";
import { parisDateKey } from "@/lib/dates/paris";
import { buildWeeklyPoints, mondayOf, type WeekTotals, type WeeklyPointsRow } from "@/lib/stats/weeklyPoints";

// Évolution des points par semaine du joueur connecté, dans la compétition
// ACTIVE, en général ou dans l'une de ses ligues (`?ligue=`). Source :
// leaderboard_snapshots (un snapshot par jour et par joueur) pour les semaines
// passées, user_scores pour la semaine en cours. Le calcul est dans
// lib/stats/weeklyPoints.ts (pur, testé).
//
// PostgREST plafonne les réponses (1 000 lignes) : si la lecture des snapshots
// de la portée est tronquée, on ne montre que les points du joueur (calculés à
// partir de ses propres snapshots) et on renonce au rang et à la moyenne plutôt
// que d'afficher des chiffres faux.

const ROW_CAP = 1000;

export type PointsEvolutionData = {
  competitionName: string;
  scopeName: string | null;
  rows: WeeklyPointsRow[];
  /** Faux = rang et moyenne de la portée indisponibles (lecture tronquée). */
  hasScopeDetails: boolean;
};

type SnapshotRow = { user_id: string; total_points: number; snapshot_date: string };

export async function getPointsEvolution(leagueId?: string | null): Promise<PointsEvolutionData | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string; name: string }>();
  if (!competition) return null;

  const scope = await resolveLeagueScope(supabase, leagueId);
  const inScope = (id: string) => (scope ? scope.memberUserIds.has(id) : true);

  // Mes snapshots : donnent les semaines et leur dernier jour.
  const { data: mine } = await supabase
    .from("leaderboard_snapshots")
    .select("user_id, total_points, snapshot_date")
    .eq("competition_id", competition.id)
    .eq("user_id", user.id)
    .order("snapshot_date", { ascending: true })
    .returns<SnapshotRow[]>();
  const mySnapshots = mine ?? [];

  const lastDayByWeek = new Map<string, string>();
  const myEndByWeek = new Map<string, number>();
  for (const snapshot of mySnapshots) {
    const week = mondayOf(snapshot.snapshot_date);
    lastDayByWeek.set(week, snapshot.snapshot_date);
    myEndByWeek.set(week, snapshot.total_points);
  }
  const boundaryDates = [...lastDayByWeek.values()];

  const [{ data: scopeSnapshots }, { data: liveScores }] = await Promise.all([
    boundaryDates.length > 0
      ? supabase
          .from("leaderboard_snapshots")
          .select("user_id, total_points, snapshot_date")
          .eq("competition_id", competition.id)
          .in("snapshot_date", boundaryDates)
          .returns<SnapshotRow[]>()
      : Promise.resolve({ data: [] as SnapshotRow[] }),
    supabase
      .from("user_scores")
      .select("user_id, total_points")
      .eq("competition_id", competition.id)
      .returns<{ user_id: string; total_points: number }[]>(),
  ]);

  const snapshotRows = scopeSnapshots ?? [];
  const live = liveScores ?? [];
  const truncated = snapshotRows.length >= ROW_CAP || live.length >= ROW_CAP;

  const currentWeek = mondayOf(parisDateKey(Date.now()));
  const weekOfDate = new Map([...lastDayByWeek].map(([week, date]) => [date, week]));

  const weeks: WeekTotals[] = [];
  if (truncated) {
    for (const [week, total] of myEndByWeek) weeks.push({ weekStart: week, totals: new Map([[user.id, total]]) });
  } else {
    const byWeek = new Map<string, Map<string, number>>();
    for (const row of snapshotRows) {
      const week = weekOfDate.get(row.snapshot_date);
      if (!week || !inScope(row.user_id)) continue;
      const totals = byWeek.get(week) ?? new Map<string, number>();
      totals.set(row.user_id, row.total_points);
      byWeek.set(week, totals);
    }
    for (const week of lastDayByWeek.keys()) weeks.push({ weekStart: week, totals: byWeek.get(week) ?? new Map() });
  }

  // Semaine en cours : totaux en direct (remplace le snapshot du jour s'il existe).
  const liveTotals = new Map<string, number>();
  for (const row of live) if (truncated ? row.user_id === user.id : inScope(row.user_id)) liveTotals.set(row.user_id, row.total_points);
  const last = weeks.at(-1);
  if (last && last.weekStart === currentWeek) last.totals = liveTotals;
  else if (liveTotals.has(user.id)) weeks.push({ weekStart: currentWeek, totals: liveTotals });

  return {
    competitionName: competition.name,
    scopeName: scope?.name ?? null,
    rows: buildWeeklyPoints(user.id, weeks, currentWeek).map((row) =>
      truncated ? { ...row, rank: null, scopeAverage: null } : row
    ),
    hasScopeDetails: !truncated,
  };
}
