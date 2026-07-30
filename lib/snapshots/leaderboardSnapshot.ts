import { getServiceClient } from "@/lib/supabase/service";
import { assignRanks, type RankableScore } from "@/lib/scoring/ranking";

// Snapshot quotidien du classement (BACKLOG_V1.md « Fun / esprit ligue entre
// potes » — socle pour "plus grosse remontée" + le futur "courbe d'évolution").
// Fréquence confirmée AVEC l'utilisateur (30/07/2026) : 1x/jour, même patron
// que lib/reminders/*.ts (service_role, déclenché par un planificateur
// GitHub Actions, endpoint Bearer SYNC_SECRET séparé).

const SNAPSHOT_TIMEZONE = "Europe/Paris";

// Même technique que lib/queries/matches.ts::localDateKey (en-CA -> YYYY-MM-DD,
// ordre lexicographique = ordre chronologique) — dupliquée plutôt que
// partagée : fonction privée de 3 lignes, pas encore de module utilitaire
// dédié aux dates dans ce projet.
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SNAPSHOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function runLeaderboardSnapshot(): Promise<{ snapshotted: number }> {
  const supabase = getServiceClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle<{ id: string }>();

  if (!competition) return { snapshotted: 0 };

  const { data: scores } = await supabase
    .from("user_scores")
    .select("user_id, total_points, correct_match_winners, exact_margins, bracket_points")
    .eq("competition_id", competition.id);

  const scoreRows = (scores ?? []) as RankableScore[];
  if (scoreRows.length === 0) return { snapshotted: 0 };

  const ranks = assignRanks(scoreRows);
  const date = todayKey();

  const rows = scoreRows.map((row) => ({
    competition_id: competition.id,
    user_id: row.user_id,
    rank: ranks.get(row.user_id)!,
    total_points: row.total_points,
    snapshot_date: date,
  }));

  // Upsert : un snapshot par (compétition, joueur, jour) — un 2e appel le
  // même jour (re-déclenchement manuel, retard de cron) MET À JOUR la ligne
  // du jour plutôt que d'en créer une seconde (contrainte unique, migration
  // #18), pour toujours refléter le classement le plus récent DU JOUR.
  const { error } = await supabase
    .from("leaderboard_snapshots")
    .upsert(rows, { onConflict: "competition_id,user_id,snapshot_date" });

  if (error) throw new Error(error.message);

  return { snapshotted: rows.length };
}
