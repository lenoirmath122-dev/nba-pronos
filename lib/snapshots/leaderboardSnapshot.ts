import { getServiceClient } from "@/lib/supabase/service";
import { assignRanks, type RankableScore } from "@/lib/scoring/ranking";
import { parisDateKey } from "@/lib/dates/paris";
import { recapBoundaryIso } from "@/lib/recaps/period";

// Snapshot quotidien du classement (BACKLOG_V1.md « Fun / esprit ligue entre
// potes » — socle pour "plus grosse remontée", la courbe d'évolution, les
// récaps et le classement hebdomadaire).
//
// FIGÉ : une fois la ligne du jour écrite, elle n'est plus jamais modifiée
// (le lot 1 du classement hebdo calcule « snapshot du lundi n − snapshot du
// lundi n-1 »). Pris au premier passage après 10h Paris, pas avant ; le
// déclenchement vient du cron Vercel de /api/recaps, la route
// /api/snapshots/leaderboard servant au secours manuel.

const LATE_AFTER_MS = 3 * 60 * 60 * 1000;

export type LeaderboardSnapshotResult = {
  snapshotted: number;
  skipped?: "avant 10h" | "déjà figé" | "aucune compétition active" | "aucun score";
  /** Figé plus de 3 h après 10h Paris : à signaler, pas bloquant. */
  late?: boolean;
};

export async function runLeaderboardSnapshot(
  nowMs: number = Date.now(),
  options: { force?: boolean } = {},
): Promise<LeaderboardSnapshotResult> {
  const date = parisDateKey(nowMs);
  const boundaryMs = Date.parse(recapBoundaryIso(date));

  // `force` ne lève que la garde des 10h, jamais le « déjà figé ». Attention :
  // forcer avant 10h fige le jour trop tôt, sans retour sauf DELETE à la main.
  if (!options.force && nowMs < boundaryMs) {
    return { snapshotted: 0, skipped: "avant 10h" };
  }

  const supabase = getServiceClient();

  const { data: competition, error: competitionError } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();

  if (competitionError) throw new Error(`Lecture de la compétition : ${competitionError.message}`);
  if (!competition) return { snapshotted: 0, skipped: "aucune compétition active" };

  // Test au niveau du JOUR, pas du joueur : sinon un joueur inscrit entre
  // deux passages serait ajouté avec un rang calculé à un autre instant que
  // celui des autres.
  const { data: existing, error: existingError } = await supabase
    .from("leaderboard_snapshots")
    .select("user_id")
    .eq("competition_id", competition.id)
    .eq("snapshot_date", date)
    .limit(1);

  if (existingError) throw new Error(`Lecture des snapshots : ${existingError.message}`);
  if (existing && existing.length > 0) return { snapshotted: 0, skipped: "déjà figé" };

  const { data: scores, error: scoresError } = await supabase
    .from("user_scores")
    .select("user_id, total_points, correct_match_winners, exact_margins, bracket_points")
    .eq("competition_id", competition.id);

  if (scoresError) throw new Error(`Lecture des scores : ${scoresError.message}`);

  const scoreRows = (scores ?? []) as RankableScore[];
  if (scoreRows.length === 0) return { snapshotted: 0, skipped: "aucun score" };

  const ranks = assignRanks(scoreRows);

  const rows = scoreRows.map((row) => ({
    competition_id: competition.id,
    user_id: row.user_id,
    rank: ranks.get(row.user_id)!,
    total_points: row.total_points,
    correct_match_winners: row.correct_match_winners,
    exact_margins: row.exact_margins,
    snapshot_date: date,
  }));

  // ON CONFLICT DO NOTHING : simple filet si deux appels arrivent en même
  // temps. `select` ne renvoie que les lignes réellement insérées.
  const { data: inserted, error } = await supabase
    .from("leaderboard_snapshots")
    .upsert(rows, { onConflict: "competition_id,user_id,snapshot_date", ignoreDuplicates: true })
    .select("user_id");

  if (error) throw new Error(`Écriture du snapshot : ${error.message}`);

  const result: LeaderboardSnapshotResult = { snapshotted: inserted?.length ?? 0 };
  if (nowMs - boundaryMs > LATE_AFTER_MS) result.late = true;
  return result;
}
