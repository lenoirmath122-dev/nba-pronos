import type { getServerClient } from "@/lib/supabase/server";

// Calcul des superlatifs de fin de compétition (BACKLOG_V1.md « Fun / esprit
// ligue entre potes »), appelé UNE SEULE FOIS par closeCompetition()
// (lib/actions/admin-competitions.ts), dans la même session admin que
// l'écriture de competition_archives — jamais recalculé après coup, jamais
// via service_role (migration #18, `competition_superlatives_insert` exige
// is_admin(), même patron que `archives_insert`).
//
// Ex-aequo : TOUS les joueurs au maximum sont crédités, aucun tie-break
// arbitraire inventé — un titre à 0/valeur nulle n'est jamais décerné (ex.
// personne n'a d'écart exact -> pas de "Sniper" cette saison-là).

type SupabaseClient = Awaited<ReturnType<typeof getServerClient>>;

export type SuperlativeKind = "NOSTRADAMUS" | "SNIPER" | "BRACKET_KING" | "BEST_ROUND1" | "BIGGEST_CLIMB";

export type SuperlativeRow = {
  competition_id: string;
  kind: SuperlativeKind;
  user_id: string;
  pseudo_snapshot: string;
  value: number;
};

type ScoreRow = {
  user_id: string;
  correct_match_winners: number;
  exact_margins: number;
  bracket_points: number;
};

function pickTopTied<T>(rows: T[], valueOf: (row: T) => number): { row: T; value: number }[] {
  let max = 0;
  for (const row of rows) max = Math.max(max, valueOf(row));
  if (max <= 0) return [];
  return rows.filter((row) => valueOf(row) === max).map((row) => ({ row, value: max }));
}

function toRows(
  competitionId: string,
  kind: SuperlativeKind,
  winners: { row: { user_id: string }; value: number }[],
  pseudoById: Map<string, string>
): SuperlativeRow[] {
  return winners.map(({ row, value }) => ({
    competition_id: competitionId,
    kind,
    user_id: row.user_id,
    pseudo_snapshot: pseudoById.get(row.user_id) ?? "—",
    value,
  }));
}

// BEST_ROUND1 : somme de points_awarded des pronos MATCH dont le match
// appartient à une série ROUND_1 de cette compétition — pas une colonne
// existante de user_scores (qui agrège TOUS les tours), requête dédiée.
async function computeRound1Points(
  supabase: SupabaseClient,
  competitionId: string
): Promise<Map<string, number>> {
  const { data: round1Series } = await supabase
    .from("series")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("round", "ROUND_1");
  const seriesIds = (round1Series ?? []).map((s) => s.id as string);
  if (seriesIds.length === 0) return new Map();

  const { data: round1Matches } = await supabase.from("matches").select("id").in("series_id", seriesIds);
  const matchIds = (round1Matches ?? []).map((m) => m.id as string);
  if (matchIds.length === 0) return new Map();

  const { data: predictions } = await supabase
    .from("match_predictions")
    .select("user_id, points_awarded")
    .in("match_id", matchIds);

  const pointsByUser = new Map<string, number>();
  for (const row of predictions ?? []) {
    const userId = row.user_id as string;
    pointsByUser.set(userId, (pointsByUser.get(userId) ?? 0) + ((row.points_awarded as number) ?? 0));
  }
  return pointsByUser;
}

// BIGGEST_CLIMB : delta entre le rang du PREMIER snapshot du jour disponible
// (migration #18, 1x/jour) et le rang FINAL déjà calculé par closeCompetition
// (`finalRanks`, même départage que le classement live). Aucun snapshot
// disponible (compétition close le jour même de sa création, avant le
// premier passage du cron) -> ce superlatif n'est simplement PAS décerné,
// jamais une erreur.
async function computeBiggestClimb(
  supabase: SupabaseClient,
  competitionId: string,
  finalRanks: Map<string, number>
): Promise<{ user_id: string; value: number }[]> {
  const { data: snapshots } = await supabase
    .from("leaderboard_snapshots")
    .select("user_id, rank, snapshot_date")
    .eq("competition_id", competitionId)
    .order("snapshot_date", { ascending: true });

  if (!snapshots || snapshots.length === 0) return [];

  const firstRankByUser = new Map<string, number>();
  for (const row of snapshots) {
    const userId = row.user_id as string;
    if (!firstRankByUser.has(userId)) firstRankByUser.set(userId, row.rank as number);
  }

  const climbs: { user_id: string; value: number }[] = [];
  for (const [userId, firstRank] of firstRankByUser) {
    const finalRank = finalRanks.get(userId);
    if (finalRank === undefined) continue; // plus dans le classement final (ne devrait pas arriver)
    climbs.push({ user_id: userId, value: firstRank - finalRank });
  }
  return climbs;
}

export async function computeSuperlatives(
  supabase: SupabaseClient,
  competitionId: string,
  scoreRows: ScoreRow[],
  finalRanks: Map<string, number>,
  pseudoById: Map<string, string>
): Promise<SuperlativeRow[]> {
  const rows: SuperlativeRow[] = [];

  rows.push(
    ...toRows(
      competitionId,
      "NOSTRADAMUS",
      pickTopTied(scoreRows, (r) => r.correct_match_winners),
      pseudoById
    )
  );
  rows.push(
    ...toRows(
      competitionId,
      "SNIPER",
      pickTopTied(scoreRows, (r) => r.exact_margins),
      pseudoById
    )
  );
  rows.push(
    ...toRows(
      competitionId,
      "BRACKET_KING",
      pickTopTied(scoreRows, (r) => r.bracket_points),
      pseudoById
    )
  );

  const round1Points = await computeRound1Points(supabase, competitionId);
  const round1Rows = [...round1Points.entries()].map(([user_id, points]) => ({ user_id, points }));
  rows.push(
    ...toRows(
      competitionId,
      "BEST_ROUND1",
      pickTopTied(round1Rows, (r) => r.points),
      pseudoById
    )
  );

  const climbs = await computeBiggestClimb(supabase, competitionId, finalRanks);
  rows.push(
    ...toRows(
      competitionId,
      "BIGGEST_CLIMB",
      pickTopTied(climbs, (r) => r.value),
      pseudoById
    )
  );

  return rows;
}
