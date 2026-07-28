import { getServiceClient } from "@/lib/supabase/service";

// Avancement du bracket (lot 2/3 « Gestion des compétitions »,
// SPEC_ECRAN_ADMIN_RESULTATS_V0_1 §4). Volontairement SÉPARÉ de
// lib/scoring/recompute.ts (T5, VALIDÉ et clos) : recomputeMatch/
// recomputeSeries ne dérivent QUE des colonnes de scoring, jamais
// series.team1_id/team2_id — une donnée OFFICIELLE réelle (qui joue
// contre qui), jamais dérivée par le moteur pur. Appelée UNIQUEMENT par
// lib/actions/admin-results.ts, après recomputeMatch.

export async function advanceWinnerIfDecided(seriesId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: series } = await supabase
    .from("series")
    .select("official_status, official_winner_team_id, next_series_id, next_series_slot")
    .eq("id", seriesId)
    .single<{
      official_status: string;
      official_winner_team_id: string | null;
      next_series_id: string | null;
      next_series_slot: 1 | 2 | null;
    }>();

  if (!series) return;
  if (series.official_status !== "FINISHED") return;
  if (!series.official_winner_team_id || !series.next_series_id || !series.next_series_slot) return;

  const column = series.next_series_slot === 1 ? "team1_id" : "team2_id";

  const { data: nextSeries } = await supabase
    .from("series")
    .select("team1_id, team2_id")
    .eq("id", series.next_series_id)
    .single<{ team1_id: string | null; team2_id: string | null }>();
  if (!nextSeries) return;
  if (nextSeries[column] !== null) return; // déjà avancé — non destructif, hors périmètre de ce lot.

  await supabase
    .from("series")
    .update({ [column]: series.official_winner_team_id })
    .eq("id", series.next_series_id);
}
