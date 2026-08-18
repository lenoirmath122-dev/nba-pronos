import { getServerClient } from "@/lib/supabase/server";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import { MATCH_SLOT_CAP, RELEASED_BET_STATUSES } from "@/lib/labels/bets";

// Lecture DÉDIÉE aux paris MATCH pour l'Accueil — miroir de
// lib/queries/series-bets.ts::getRemainingSeriesBets() pour le scope MATCH.
// Contrairement à la version séries, PAS de filtre sur competition.type : un
// pari MATCH existe aussi bien en Playoffs qu'en NBA Cup (une "série" Cup est
// un seul match). Cap MATCH_SLOT_CAP par série reproduit UNIQUEMENT pour
// Playoffs (lib/labels/bets.ts : "sans effet Cup, pas de cap série") — la Cup
// n'a donc aucun plafond agrégé ici, même absence de cap "7 au total" que
// buildBootstrap() (lib/queries/bets.ts) applique déjà aujourd'hui — pas une
// omission de ce module.

export type RemainingMatchBet = {
  matchId: string;
  label: string; // « BOS vs MIA · Game 3 · 25/07 21:00 » (Europe/Paris)
};

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };
type MatchRow = {
  id: string;
  series_id: string;
  game_number: number;
  scheduled_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
};
type TeamRow = { id: string; abbreviation: string };
type OwnBetRow = { match_id: string | null; series_id: string; status: string };

// Numéro du match dans SA série ajouté au libellé (18/08/2026, demandé par
// l'utilisateur pour la section "matches à pronostiquer" de l'Accueil, étendu
// ici — même bloc "À traiter", même besoin).
function matchLabel(homeAbbr: string, awayAbbr: string, gameNumber: number, scheduledAt: string): string {
  return `${homeAbbr} vs ${awayAbbr} · Game ${gameNumber} · ${parisDateTimeLabel(scheduledAt)}`;
}

/** Matchs où un pari MATCH reste POSSIBLE et pas encore posé — réutilisée par
 *  lib/queries/home.ts uniquement pour l'instant. */
export async function getRemainingMatchBets(): Promise<RemainingMatchBet[]> {
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
  if (!competition) return [];

  const nowIso = new Date().toISOString();
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, series_id, game_number, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competition.id)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });

  const matches = (matchesData ?? []) as MatchRow[];
  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const teamIds = [
    ...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter((id): id is string => id !== null)),
  ];

  const [{ data: teamsData }, { data: betsData }] = await Promise.all([
    teamIds.length > 0
      ? supabase.from("teams").select("id, abbreviation").in("id", teamIds)
      : Promise.resolve({ data: [] as TeamRow[] }),
    supabase
      .from("bets")
      .select("match_id, series_id, status")
      .eq("user_id", user.id)
      .eq("competition_id", competition.id)
      .eq("scope", "MATCH")
      .in("match_id", matchIds),
  ]);

  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((t) => [t.id, t.abbreviation]));
  const ownBets = (betsData ?? []) as OwnBetRow[];

  const activeMatchBetIds = new Set(
    ownBets
      .filter((b) => !RELEASED_BET_STATUSES.has(b.status) && b.match_id)
      .map((b) => b.match_id as string)
  );

  // Cap MATCH_SLOT_CAP par série — Playoffs uniquement (lib/labels/bets.ts).
  const matchSlotsUsedBySeries = new Map<string, number>();
  if (competition.type === "PLAYOFFS") {
    for (const bet of ownBets) {
      if (!RELEASED_BET_STATUSES.has(bet.status)) {
        matchSlotsUsedBySeries.set(bet.series_id, (matchSlotsUsedBySeries.get(bet.series_id) ?? 0) + 1);
      }
    }
  }

  return matches
    .filter((m) => !activeMatchBetIds.has(m.id))
    .filter((m) => {
      if (competition.type !== "PLAYOFFS") return true;
      return (matchSlotsUsedBySeries.get(m.series_id) ?? 0) < MATCH_SLOT_CAP;
    })
    .map((m) => ({
      matchId: m.id,
      label: matchLabel(
        teams.get(m.home_team_id ?? "") ?? "?",
        teams.get(m.away_team_id ?? "") ?? "?",
        m.game_number,
        m.scheduled_at
      ),
    }));
}
