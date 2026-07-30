import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";

// Lecture de la file des requêtes admin (SPEC_ECRAN_ADMIN_REQUESTS_V0_1
// §1/§2) — TOUTES les correction_requests PENDING, MATCH_PREDICTION ET
// BET (0.2.7 §6 : une seule file, pas de distinction par type de cible).

const MATCH_LABEL_TIMEZONE = "Europe/Paris";

function matchLabel(gameNumber: number, scheduledAt: string | null): string {
  if (!scheduledAt) return `Match ${gameNumber} — date à confirmer`;
  const date = new Date(scheduledAt);
  const datePart = new Intl.DateTimeFormat("fr-FR", { timeZone: MATCH_LABEL_TIMEZONE, day: "2-digit", month: "2-digit" }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeZone: MATCH_LABEL_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `Match ${gameNumber} — ${datePart} ${timePart}`;
}

function seriesLabel(round: string, team1Abbr: string | undefined, team2Abbr: string | undefined): string {
  const roundLabel = ROUND_LABELS[round] ?? round;
  return team1Abbr && team2Abbr ? `${roundLabel} — ${team1Abbr} vs ${team2Abbr}` : roundLabel;
}

export type TeamOption = { id: string; abbreviation: string };

export type MatchPredictionRequest = {
  requestId: string;
  requesterUserId: string; // ajouté le 30/07/2026, lien /players/[userId]
  requesterPseudo: string;
  justification: string;
  createdAt: string;
  targetType: "MATCH_PREDICTION";
  matchId: string;
  targetLabel: string;
  currentWinnerTeamId: string | null;
  currentMargin: number | null;
  proposedWinnerTeamId: string | null;
  proposedMargin: number | null;
  teamOptions: [TeamOption, TeamOption];
};

export type BetStatusValue = "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";

export type BetRequest = {
  requestId: string;
  requesterUserId: string; // ajouté le 30/07/2026, lien /players/[userId]
  requesterPseudo: string;
  justification: string;
  createdAt: string;
  targetType: "BET";
  betId: string;
  targetLabel: string;
  description: string;
  /** Statut ACTUEL du pari — pilote l'UI (migration #13, GAPS_OUVERTS.md
   *  "contester un pari REJETÉ ou déjà résolu") : VALIDATED (jamais résolu,
   *  cas d'origine) → renvoie vers /admin/resolution ; REJECTED/WON/LOST
   *  (contesté) → l'admin choisit directement le nouveau statut ici. */
  currentStatus: BetStatusValue;
  /** NULL si le pari n'a jamais été validé (refusé dès SUBMITTED) — dans ce
   *  cas, la réouverture vers VALIDATED/WON/LOST exige de fournir une
   *  difficulté (le formulaire la propose, défaut = proposedDifficulty). */
  currentValidatedDifficulty: number | null;
  proposedDifficulty: number;
};

export type PendingCorrectionRequest = MatchPredictionRequest | BetRequest;

type RequestRow = {
  id: string;
  requester_user_id: string;
  justification: string;
  created_at: string;
  target_type: "MATCH_PREDICTION" | "BET";
  target_match_prediction_id: string | null;
  target_bet_id: string | null;
  proposed_winner_team_id: string | null;
  proposed_margin: number | null;
};

type MatchRow = { id: string; game_number: number; scheduled_at: string | null; home_team_id: string | null; away_team_id: string | null };
type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null };
type BetRow = {
  id: string;
  scope: "SERIES" | "MATCH";
  series_id: string;
  match_id: string | null;
  description: string;
  status: BetStatusValue;
  validated_difficulty: number | null;
  proposed_difficulty: number;
};

export async function getPendingCorrectionRequests(): Promise<PendingCorrectionRequest[]> {
  const supabase = await getServerClient();

  const { data: requestsData } = await supabase
    .from("correction_requests")
    .select(
      "id, requester_user_id, justification, created_at, target_type, target_match_prediction_id, target_bet_id, proposed_winner_team_id, proposed_margin"
    )
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });
  const requests = (requestsData ?? []) as RequestRow[];
  if (requests.length === 0) return [];

  const userIds = [...new Set(requests.map((r) => r.requester_user_id))];
  const predictionIds = requests.filter((r) => r.target_type === "MATCH_PREDICTION").map((r) => r.target_match_prediction_id as string);
  const betIds = requests.filter((r) => r.target_type === "BET").map((r) => r.target_bet_id as string);

  const [{ data: usersData }, { data: predictionsData }, { data: betsData }] = await Promise.all([
    supabase.from("users").select("id, pseudo").in("id", userIds),
    predictionIds.length > 0
      ? supabase.from("match_predictions").select("id, match_id, predicted_winner_team_id, predicted_margin").in("id", predictionIds)
      : Promise.resolve({ data: [] as { id: string; match_id: string; predicted_winner_team_id: string | null; predicted_margin: number | null }[] }),
    betIds.length > 0
      ? supabase
          .from("bets")
          .select("id, scope, series_id, match_id, description, status, validated_difficulty, proposed_difficulty")
          .in("id", betIds)
      : Promise.resolve({ data: [] as BetRow[] }),
  ]);

  const pseudoById = new Map((usersData ?? []).map((u) => [u.id as string, u.pseudo as string]));
  const predictionById = new Map((predictionsData ?? []).map((p) => [p.id, p]));
  const bets = (betsData ?? []) as BetRow[];
  const betById = new Map(bets.map((b) => [b.id, b]));

  // Matchs référencés directement par un prono, OU par un pari MATCH.
  const predictionMatchIds = [...predictionById.values()].map((p) => p.match_id);
  const betMatchIds = bets.filter((b) => b.scope === "MATCH" && b.match_id).map((b) => b.match_id as string);
  const matchIds = [...new Set([...predictionMatchIds, ...betMatchIds])];
  const { data: matchesData } =
    matchIds.length > 0
      ? await supabase.from("matches").select("id, game_number, scheduled_at, home_team_id, away_team_id").in("id", matchIds)
      : { data: [] as MatchRow[] };
  const matchById = new Map(((matchesData ?? []) as MatchRow[]).map((m) => [m.id, m]));

  // Séries référencées par un pari SERIES (pour son libellé).
  const betSeriesIds = [...new Set(bets.filter((b) => b.scope === "SERIES").map((b) => b.series_id))];
  const { data: seriesData } =
    betSeriesIds.length > 0
      ? await supabase.from("series").select("id, round, team1_id, team2_id").in("id", betSeriesIds)
      : { data: [] as SeriesRow[] };
  const seriesById = new Map(((seriesData ?? []) as SeriesRow[]).map((s) => [s.id, s]));

  const teamIds = [
    ...new Set([
      ...(matchesData ?? []).flatMap((m: MatchRow) => [m.home_team_id, m.away_team_id]),
      ...(seriesData ?? []).flatMap((s: SeriesRow) => [s.team1_id, s.team2_id]),
    ].filter((id): id is string => id !== null)),
  ];
  const { data: teamsData } =
    teamIds.length > 0 ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds) : { data: [] as TeamOption[] };
  const teamById = new Map(((teamsData ?? []) as TeamOption[]).map((t) => [t.id, t]));

  const results: PendingCorrectionRequest[] = [];

  for (const r of requests) {
    const requesterPseudo = pseudoById.get(r.requester_user_id) ?? "—";

    if (r.target_type === "MATCH_PREDICTION" && r.target_match_prediction_id) {
      const prediction = predictionById.get(r.target_match_prediction_id);
      const match = prediction ? matchById.get(prediction.match_id) : undefined;
      if (!prediction || !match) continue; // donnée incohérente, ignorée plutôt que planter l'écran
      const home = match.home_team_id ? teamById.get(match.home_team_id) : undefined;
      const away = match.away_team_id ? teamById.get(match.away_team_id) : undefined;
      if (!home || !away) continue;

      results.push({
        requestId: r.id,
        requesterUserId: r.requester_user_id,
        requesterPseudo,
        justification: r.justification,
        createdAt: r.created_at,
        targetType: "MATCH_PREDICTION",
        matchId: match.id,
        targetLabel: matchLabel(match.game_number, match.scheduled_at),
        currentWinnerTeamId: prediction.predicted_winner_team_id,
        currentMargin: prediction.predicted_margin,
        proposedWinnerTeamId: r.proposed_winner_team_id,
        proposedMargin: r.proposed_margin,
        teamOptions: [home, away],
      });
    } else if (r.target_type === "BET" && r.target_bet_id) {
      const bet = betById.get(r.target_bet_id);
      if (!bet) continue;

      let targetLabel = "—";
      if (bet.scope === "MATCH" && bet.match_id) {
        const match = matchById.get(bet.match_id);
        if (match) targetLabel = matchLabel(match.game_number, match.scheduled_at);
      } else {
        const series = seriesById.get(bet.series_id);
        if (series) {
          const team1 = series.team1_id ? teamById.get(series.team1_id)?.abbreviation : undefined;
          const team2 = series.team2_id ? teamById.get(series.team2_id)?.abbreviation : undefined;
          targetLabel = seriesLabel(series.round, team1, team2);
        }
      }

      results.push({
        requestId: r.id,
        requesterUserId: r.requester_user_id,
        requesterPseudo,
        justification: r.justification,
        createdAt: r.created_at,
        targetType: "BET",
        betId: bet.id,
        targetLabel,
        description: bet.description,
        currentStatus: bet.status,
        currentValidatedDifficulty: bet.validated_difficulty,
        proposedDifficulty: bet.proposed_difficulty,
      });
    }
  }

  return results;
}
