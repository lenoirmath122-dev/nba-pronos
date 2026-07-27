import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { MATCH_SLOT_CAP } from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";

// Lecture de l'écran Mes paris (SPEC_ECRAN_MES_PARIS_V0_1 §10). PERSONNEL
// uniquement (§2 de la spec) : ne lit que `user_id = auth.uid()`, jamais
// `bet_is_public()` (révélation publique des autres joueurs reportée).

export type BetStatusValue = "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";

export type MyBet = {
  betId: string;
  scope: "SERIES" | "MATCH";
  targetLabel: string;
  targetDate: string | null; // ISO — tri (§6)
  description: string;
  category: BetCategory;
  difficulty: BetDifficulty;
  /** validated_difficulty ?? proposed_difficulty — la validée fait foi (même convention qu'AssociatedBet, Mes pronos). */
  isDifficultyValidated: boolean;
  status: BetStatusValue;
  isAdminCorrected: boolean;
  refusalReason: string | null;
  resolutionReason: string | null;
  pointsAwarded: number | null;
  isForgottenResolution: boolean; // VALIDATED + cible FINISHED, éligible §7
  hasPendingCorrectionRequest: boolean;
};

export type QuotaSummary =
  | { kind: "PLAYOFFS"; seriesId: string; seriesLabel: string; seriesSlotUsed: boolean; matchSlotsUsed: number }
  | { kind: "NBA_CUP"; matchId: string; matchLabel: string; matchSlotUsed: boolean };

export type MyBetsData = {
  competitionId: string | null;
  ongoing: MyBet[];
  finished: MyBet[];
  quotas: QuotaSummary[]; // uniquement pour "En cours" (§6)
};

// Un pari compte pour le quota tant qu'il est ONGOING (§4/§6) — REJECTED et
// CANCELLED libèrent toujours leur slot (0.2.4 §6), donc simplement ne pas
// être dans cet ensemble suffit ici (pas besoin d'un 2e Set dédié comme dans
// lib/queries/bets.ts, qui doit distinguer explicitement les deux).
const ONGOING_STATUSES = new Set(["DRAFT", "SUBMITTED", "VALIDATED"]);

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };

type BetRow = {
  id: string;
  scope: "SERIES" | "MATCH";
  series_id: string;
  match_id: string | null;
  description: string;
  proposed_category: BetCategory;
  validated_category: BetCategory | null;
  proposed_difficulty: BetDifficulty;
  validated_difficulty: BetDifficulty | null;
  status: BetStatusValue;
  is_admin_corrected: boolean;
  refusal_reason: string | null;
  resolution_reason: string | null;
  points_awarded: number | null;
};

// Colonne réellement nommée `official_status` sur `series` (PAS `status`,
// contrairement à `matches` — vérifié dans le schéma réel, pas supposé).
type SeriesRow = { id: string; round: string; team1_id: string | null; team2_id: string | null; official_status: string };
type MatchRow = { id: string; series_id: string; game_number: number; scheduled_at: string | null; status: string };

const MATCH_LABEL_TIMEZONE = "Europe/Paris";

function matchLabel(gameNumber: number, scheduledAt: string | null): string {
  if (!scheduledAt) return `Match ${gameNumber} — date à confirmer`;
  const date = new Date(scheduledAt);
  const datePart = new Intl.DateTimeFormat("fr-FR", { timeZone: MATCH_LABEL_TIMEZONE, day: "2-digit", month: "2-digit" }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeZone: MATCH_LABEL_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `Match ${gameNumber} — ${datePart} ${timePart}`;
}

// Même construction que lib/queries/bets.ts (team1_id/team2_id de la série,
// jamais les home/away d'un match, qui peuvent être inversés d'un match à
// l'autre de la même série).
function seriesLabel(s: SeriesRow, abbrevById: Map<string, string>): string {
  const round = ROUND_LABELS[s.round] ?? s.round;
  const team1 = s.team1_id ? abbrevById.get(s.team1_id) : undefined;
  const team2 = s.team2_id ? abbrevById.get(s.team2_id) : undefined;
  return team1 && team2 ? `${round} — ${team1} vs ${team2}` : round;
}

export async function getMyBets(): Promise<MyBetsData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { competitionId: null, ongoing: [], finished: [], quotas: [] };

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) return { competitionId: null, ongoing: [], finished: [], quotas: [] };

  const { data: betsData } = await supabase
    .from("bets")
    .select(
      "id, scope, series_id, match_id, description, proposed_category, validated_category, proposed_difficulty, validated_difficulty, status, is_admin_corrected, refusal_reason, resolution_reason, points_awarded"
    )
    .eq("user_id", user.id)
    .eq("competition_id", competition.id);

  const bets = (betsData ?? []) as BetRow[];

  if (bets.length === 0) {
    return { competitionId: competition.id, ongoing: [], finished: [], quotas: [] };
  }

  const seriesIds = [...new Set(bets.map((b) => b.series_id))];
  const matchIds = [...new Set(bets.map((b) => b.match_id).filter((id): id is string => id !== null))];

  const [{ data: seriesData }, { data: matchesData }, { data: pendingData }] = await Promise.all([
    supabase.from("series").select("id, round, team1_id, team2_id, official_status").in("id", seriesIds),
    matchIds.length > 0
      ? supabase.from("matches").select("id, series_id, game_number, scheduled_at, status").in("id", matchIds)
      : Promise.resolve({ data: [] as MatchRow[] }),
    supabase
      .from("correction_requests")
      .select("target_bet_id")
      .eq("requester_user_id", user.id)
      .eq("status", "PENDING")
      .in("target_bet_id", bets.map((b) => b.id)),
  ]);

  const series = (seriesData ?? []) as SeriesRow[];
  const matches = (matchesData ?? []) as MatchRow[];
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const pendingBetIds = new Set((pendingData ?? []).map((r) => r.target_bet_id as string));

  const teamIds = [...new Set(series.flatMap((s) => [s.team1_id, s.team2_id]).filter((id): id is string => id !== null))];
  const { data: teamsData } =
    teamIds.length > 0
      ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds)
      : { data: [] as { id: string; abbreviation: string }[] };
  const abbrevById = new Map((teamsData ?? []).map((t) => [t.id, t.abbreviation]));

  const myBets: MyBet[] = bets.map((b) => {
    const s = seriesById.get(b.series_id);
    const m = b.match_id ? matchById.get(b.match_id) : null;

    const targetLabel = b.scope === "MATCH" && m ? matchLabel(m.game_number, m.scheduled_at) : s ? seriesLabel(s, abbrevById) : "—";
    const targetDate = b.scope === "MATCH" ? (m?.scheduled_at ?? null) : firstMatchDate(b.series_id, matches);

    const targetFinished = b.scope === "MATCH" ? m?.status === "FINISHED" : s?.official_status === "FINISHED";

    return {
      betId: b.id,
      scope: b.scope,
      targetLabel,
      targetDate,
      description: b.description,
      category: b.validated_category ?? b.proposed_category,
      difficulty: b.validated_difficulty ?? b.proposed_difficulty,
      isDifficultyValidated: b.validated_difficulty !== null,
      status: b.status,
      isAdminCorrected: b.is_admin_corrected,
      refusalReason: b.refusal_reason,
      resolutionReason: b.resolution_reason,
      pointsAwarded: b.points_awarded,
      isForgottenResolution: b.status === "VALIDATED" && Boolean(targetFinished),
      hasPendingCorrectionRequest: pendingBetIds.has(b.id),
    };
  });

  const ongoing = myBets
    .filter((b) => ONGOING_STATUSES.has(b.status))
    .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"));
  const finished = myBets
    .filter((b) => !ONGOING_STATUSES.has(b.status))
    .sort((a, b) => (b.targetDate ?? "").localeCompare(a.targetDate ?? ""));

  const quotas = buildQuotas(competition, bets, series, matches, abbrevById);

  return { competitionId: competition.id, ongoing, finished, quotas };
}

function firstMatchDate(seriesId: string, matches: MatchRow[]): string | null {
  const seriesMatches = matches.filter((m) => m.series_id === seriesId);
  const dates = seriesMatches.map((m) => m.scheduled_at).filter((v): v is string => v !== null).sort();
  return dates[0] ?? null;
}

function buildQuotas(
  competition: CompetitionRow,
  bets: BetRow[],
  series: SeriesRow[],
  matches: MatchRow[],
  abbrevById: Map<string, string>
): QuotaSummary[] {
  const activeBets = bets.filter((b) => ONGOING_STATUSES.has(b.status));

  if (competition.type === "NBA_CUP") {
    // Cup : 1 pari max par match, jusqu'à 7 sur toute la compétition (§4 —
    // amendement 20/07/2026, decisions_nba_cup_mecanique_scoring.md §6).
    const matchIdsWithBet = new Set(activeBets.map((b) => b.match_id).filter((id): id is string => id !== null));
    return [...matchIdsWithBet].map((matchId) => {
      const m = matches.find((mm) => mm.id === matchId);
      return {
        kind: "NBA_CUP" as const,
        matchId,
        matchLabel: m ? matchLabel(m.game_number, m.scheduled_at) : "—",
        matchSlotUsed: true,
      };
    });
  }

  // Playoffs : par série ayant AU MOINS un pari actif — 1/1 série + X/3 match
  // (§4, MATCH_SLOT_CAP réutilisé tel quel).
  const seriesIdsWithBet = new Set(activeBets.map((b) => b.series_id));
  return [...seriesIdsWithBet].map((seriesId) => {
    const s = series.find((ss) => ss.id === seriesId);
    const seriesBets = activeBets.filter((b) => b.series_id === seriesId);
    return {
      kind: "PLAYOFFS" as const,
      seriesId,
      seriesLabel: s ? seriesLabel(s, abbrevById) : "—",
      seriesSlotUsed: seriesBets.some((b) => b.scope === "SERIES"),
      matchSlotsUsed: seriesBets.filter((b) => b.scope === "MATCH").length,
    };
  });
}

export { MATCH_SLOT_CAP };
