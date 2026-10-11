import type { getServerClient } from "@/lib/supabase/server";
import { resolveLeagueScope } from "@/lib/queries/leagues";
import { computeWeeklyStandings, weekEndFor, type WeeklySnapshotRow } from "@/lib/weekly/standings";
import {
  countdownLabel,
  nextWeekBoundaryIso,
  resolveCurrentWeekStart,
  scoresToSnapshotRows,
} from "@/lib/weekly/currentWeek";

// Lecture de la vue Semaine du Classement (lot 2 du classement hebdo).
// Séparée de getLeaderboard : aucune colonne ni table du classement hebdo ne
// doit pouvoir casser la vue Générale. Appelée avec le client serveur (RLS,
// jamais service_role) ; weekly_rankings, weekly_champions et
// leaderboard_snapshots sont en lecture publique.
//
// Limite connue, héritée de getLeaderboard : PostgREST plafonne une lecture à
// 1000 lignes (user_scores, snapshot). Sans risque aux volumes actuels ; à
// traiter d'un bloc (fin ET début) le jour où c'est nécessaire, pour que les
// deux restent cohérents.

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

export type WeeklyLeaderboardRow = {
  userId: string;
  pseudo: string;
  rank: number;
  /** Points de la semaine ; négatif possible (correction admin rétroactive). */
  points: number;
  correctMatchWinners: number | null;
  exactMargins: number | null;
  isInactive: boolean;
  isCurrentUser: boolean;
};

export type LastWeekChampions = {
  weekEndDate: string;
  champions: { userId: string; pseudo: string; points: number }[];
} | null;

export type WeeklyLeaderboardData = {
  /** "pending" : des snapshots existent mais aucun depuis le lundi 10h (cron
   *  pas encore passé) ; pas de classement à afficher.
   *  "error" : une lecture a échoué ; mieux vaut ne rien afficher que des
   *  points faux (total général pris pour les points de la semaine). */
  state: "ok" | "pending" | "error";
  weekStart: string;
  endsAtIso: string;
  /** « Fin dans 2 j 5 h », calculé ici : la page reste pure (pas de Date.now). */
  countdown: string;
  /** Date du snapshot de départ ; null = aucun snapshot, tout le monde part de 0. */
  startSnapshotDate: string | null;
  /** Snapshot de départ postérieur au lundi (pris en retard). */
  late: boolean;
  tiebreakAvailable: boolean;
  rows: WeeklyLeaderboardRow[];
  currentUserRank: number | null;
  rankedCount: number;
  /** Champion(s) de la semaine qui vient de se terminer (week_end_date =
   *  weekStart). Null si cette semaine n'est pas (encore) figée, n'a pas de
   *  champion, ou en portée ligue (weekly_champions est global). */
  lastChampions: LastWeekChampions;
  scopeLeagueId: string | null;
  scopeLeagueName: string | null;
};

type ScoreRow = {
  user_id: string;
  total_points: number;
  correct_match_winners: number;
  exact_margins: number;
};

const SNAPSHOT_COLUMNS = "user_id, total_points, correct_match_winners, exact_margins";

export async function getWeeklyLeaderboard(
  supabase: SupabaseServerClient,
  options: { competitionId: string; leagueId: string | null; userId: string | null; nowMs?: number },
): Promise<WeeklyLeaderboardData> {
  const { competitionId, leagueId, userId } = options;
  const nowMs = options.nowMs ?? Date.now();
  const weekStart = weekEndFor(nowMs);
  const endsAtIso = nextWeekBoundaryIso(nowMs);

  const [frozen, earliest, before, scoresResult, latestFrozen, scope] = await Promise.all([
    supabase
      .from("weekly_rankings")
      .select("end_snapshot_date")
      .eq("competition_id", competitionId)
      .eq("week_end_date", weekStart)
      .maybeSingle<{ end_snapshot_date: string }>(),
    supabase
      .from("leaderboard_snapshots")
      .select("snapshot_date")
      .eq("competition_id", competitionId)
      .gte("snapshot_date", weekStart)
      .order("snapshot_date", { ascending: true })
      .limit(1)
      .maybeSingle<{ snapshot_date: string }>(),
    supabase
      .from("leaderboard_snapshots")
      .select("snapshot_date")
      .eq("competition_id", competitionId)
      .lt("snapshot_date", weekStart)
      .limit(1)
      .maybeSingle<{ snapshot_date: string }>(),
    supabase
      .from("user_scores")
      .select("user_id, total_points, correct_match_winners, exact_margins")
      .eq("competition_id", competitionId),
    supabase
      .from("weekly_rankings")
      .select("week_end_date")
      .eq("competition_id", competitionId)
      .order("week_end_date", { ascending: false })
      .limit(1)
      .maybeSingle<{ week_end_date: string }>(),
    resolveLeagueScope(supabase, leagueId),
  ]);

  const scopeLeagueId = scope?.id ?? null;
  const scopeLeagueName = scope?.name ?? null;
  const scopeUserIds = scope?.memberUserIds ?? null;

  // Seule la semaine qui se termine à weekStart compte : un figement manqué ne
  // doit pas faire afficher le champion d'il y a deux semaines.
  const lastFrozenWeek =
    latestFrozen.data?.week_end_date === weekStart ? latestFrozen.data.week_end_date : null;

  const championsPromise = lastFrozenWeek
    ? supabase
        .from("weekly_champions")
        .select("user_id, points")
        .eq("competition_id", competitionId)
        .eq("week_end_date", lastFrozenWeek)
        .order("points", { ascending: false })
    : Promise.resolve({ data: [] as { user_id: string; points: number }[] });

  const startResolution = resolveCurrentWeekStart({
    weekStart,
    frozenEndDate: frozen.data?.end_snapshot_date ?? null,
    earliestOnOrAfterStart: earliest.data?.snapshot_date ?? null,
    anySnapshotBefore: before.data !== null && before.data !== undefined,
  });

  const [championRows, startRowsResult] = await Promise.all([
    championsPromise,
    startResolution.ok && startResolution.start
      ? supabase
          .from("leaderboard_snapshots")
          .select(SNAPSHOT_COLUMNS)
          .eq("competition_id", competitionId)
          .eq("snapshot_date", startResolution.start)
      : Promise.resolve({ data: [] as WeeklySnapshotRow[], error: null }),
  ]);

  const championIds = (championRows.data ?? []).map((row) => row.user_id as string);
  const allScores = (scoresResult.data ?? []) as ScoreRow[];
  const endRows = scopeUserIds ? allScores.filter((row) => scopeUserIds.has(row.user_id)) : allScores;

  const userIds = [...new Set([...endRows.map((row) => row.user_id), ...championIds])];
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from("users").select("id, pseudo, status").in("id", userIds)
      : { data: [] as { id: string; pseudo: string; status: string }[] };
  const profileById = new Map(
    (profiles ?? []).map((row) => [row.id as string, { pseudo: row.pseudo as string, isInactive: row.status === "DISABLED" }]),
  );

  const lastChampions: LastWeekChampions =
    !scopeUserIds && lastFrozenWeek && championIds.length > 0
      ? {
          weekEndDate: lastFrozenWeek,
          champions: (championRows.data ?? []).map((row) => ({
            userId: row.user_id as string,
            pseudo: profileById.get(row.user_id as string)?.pseudo ?? "",
            points: row.points as number,
          })),
        }
      : null;

  const base = {
    weekStart,
    endsAtIso,
    countdown: countdownLabel(nowMs, endsAtIso),
    lastChampions,
    scopeLeagueId,
    scopeLeagueName,
  };

  // Une lecture en erreur ressemblerait à « pas de snapshot » et ferait
  // classer tout le monde sur son total général : on ne publie rien.
  if (earliest.error || before.error || scoresResult.error || startRowsResult.error) {
    return {
      ...base,
      state: "error",
      startSnapshotDate: null,
      late: false,
      tiebreakAvailable: false,
      rows: [],
      currentUserRank: null,
      rankedCount: 0,
    };
  }

  if (!startResolution.ok) {
    return {
      ...base,
      state: "pending",
      startSnapshotDate: null,
      late: false,
      tiebreakAvailable: false,
      rows: [],
      currentUserRank: null,
      rankedCount: 0,
    };
  }

  const startRows = ((startRowsResult.data ?? []) as WeeklySnapshotRow[]).filter(
    (row) => !scopeUserIds || scopeUserIds.has(row.user_id),
  );
  const { standings, tiebreakAvailable } = computeWeeklyStandings(startRows, scoresToSnapshotRows(endRows));

  const rows: WeeklyLeaderboardRow[] = standings
    .map((standing) => {
    const profile = profileById.get(standing.userId);
    return {
      userId: standing.userId,
      pseudo: profile?.pseudo ?? "",
      rank: standing.rank,
      points: standing.points,
      correctMatchWinners: standing.correctMatchWinners,
      exactMargins: standing.exactMargins,
      isInactive: profile?.isInactive ?? false,
      isCurrentUser: standing.userId === userId,
    };
  })
    // Ordre stable à rang égal : sans critère final, l'ordre des ex æquo
    // suivrait celui de la lecture et changerait d'un rechargement à l'autre.
    .sort((a, b) => a.rank - b.rank || a.pseudo.localeCompare(b.pseudo, "fr") || a.userId.localeCompare(b.userId));

  return {
    ...base,
    state: "ok",
    startSnapshotDate: startResolution.start,
    late: startResolution.late,
    tiebreakAvailable,
    rows,
    currentUserRank: rows.find((row) => row.isCurrentUser)?.rank ?? null,
    rankedCount: rows.length,
  };
}
