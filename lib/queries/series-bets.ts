import { getServerClient } from "@/lib/supabase/server";
import { RELEASED_BET_STATUSES } from "@/lib/labels/bets";

// Lecture DÉDIÉE aux paris SÉRIES pour l'Accueil et le hub Jouer — DISTINCT de
// lib/queries/bracket-fill.ts::computeCandidateTeamIds, qui dérive les
// candidats de tour 2+ des PICKS du joueur (correct pour l'écran de
// remplissage /play/bracket, verrouillé avant tout résultat réel de tour 2+ —
// voir la RÈGLE NON NÉGOCIABLE en tête de ce fichier). Un pari SÉRIE, lui,
// reste ouvert jusqu'au coup d'envoi RÉEL de la série — donc potentiellement
// après que le tour précédent soit réellement terminé. Ce module lit donc
// DIRECTEMENT series.team1_id/team2_id (mêmes colonnes que
// lib/queries/bracket.ts, tenues à jour par le cascade admin
// lib/scoring/advancement.ts au fur et à mesure des résultats réels), jamais
// les picks du joueur.
//
// Bug corrigé le 04/08/2026 (signalé par l'utilisateur) : l'Accueil proposait
// des paris sur les affiches du BRACKET PERSONNEL du joueur, pas les affiches
// réelles qualifiées.

export type RemainingSeriesBet = {
  seriesId: string;
  round: string;
  teamA: { abbreviation: string };
  teamB: { abbreviation: string };
};

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };
type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };
type TeamRow = { id: string; abbreviation: string };
type SeriesBetRow = { series_id: string; status: string };
type MatchRow = { series_id: string; scheduled_at: string };

/** Séries où un pari SÉRIE reste POSSIBLE et pas encore posé, sur les VRAIES
 *  équipes qualifiées — NBA Cup exclue (pas de paris séries, une "série" y
 *  est 1 seul match). Réutilisée par lib/queries/home.ts et
 *  lib/queries/play-hub.ts — jamais recalculée deux fois avec une logique
 *  divergente. */
export async function getRemainingSeriesBets(): Promise<RemainingSeriesBet[]> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();
  if (!competition || competition.type !== "PLAYOFFS") return [];

  const { data: seriesData } = await supabase
    .from("series")
    .select("id, round, team1_id, team2_id")
    .eq("competition_id", competition.id);
  const series = (seriesData ?? []) as SeriesRow[];

  const knownSeries = series.filter((s) => s.team1_id !== null && s.team2_id !== null);
  if (knownSeries.length === 0) return [];

  const knownSeriesIds = knownSeries.map((s) => s.id);

  const [{ data: teamsData }, { data: betsData }, { data: matchesData }] = await Promise.all([
    supabase.from("teams").select("id, abbreviation"),
    supabase
      .from("bets")
      .select("series_id, status")
      .eq("user_id", user.id)
      .eq("competition_id", competition.id)
      .eq("scope", "SERIES")
      .in("series_id", knownSeriesIds),
    supabase
      .from("matches")
      .select("series_id, scheduled_at")
      .eq("competition_id", competition.id)
      .in("series_id", knownSeriesIds)
      .not("scheduled_at", "is", null),
  ]);

  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, t.abbreviation]));

  const activeBetSeriesIds = new Set(
    ((betsData ?? []) as SeriesBetRow[])
      .filter((row) => !RELEASED_BET_STATUSES.has(row.status))
      .map((row) => row.series_id)
  );

  // Reproduit public.bet_deadline_open(SERIES, ...) (T3 §2) : coup d'envoi du
  // 1er match de la série. Aucun match programmé → deadline toujours ouverte.
  const earliestKickoffBySeries = new Map<string, number>();
  for (const match of (matchesData ?? []) as MatchRow[]) {
    const scheduledMs = Date.parse(match.scheduled_at);
    const current = earliestKickoffBySeries.get(match.series_id);
    if (current === undefined || scheduledMs < current) {
      earliestKickoffBySeries.set(match.series_id, scheduledMs);
    }
  }

  const nowMs = Date.now();

  return knownSeries
    .filter((s) => !activeBetSeriesIds.has(s.id))
    .filter((s) => {
      const kickoffMs = earliestKickoffBySeries.get(s.id);
      return kickoffMs === undefined || kickoffMs > nowMs;
    })
    .map((s) => ({
      seriesId: s.id,
      round: s.round,
      teamA: { abbreviation: teams.get(s.team1_id as string) ?? "?" },
      teamB: { abbreviation: teams.get(s.team2_id as string) ?? "?" },
    }));
}
