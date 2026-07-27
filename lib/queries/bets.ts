import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { BET_CATEGORY_OPTIONS, MATCH_SLOT_CAP } from "@/lib/labels/bets";
import type { BetCategory, BetDifficulty } from "@/lib/labels/bets";
import type { TeamRef } from "@/lib/queries/matches";

// Lecture de l'écran "Nouveau pari" (composants serveur uniquement),
// SPEC_ECRAN_NOUVEAU_PARI_V0_1 §10. Un seul module, appelé avec
// getServerClient() (jamais service_role) : la RLS reste seule autorité de
// visibilité. Tous les booléens de disponibilité (*Open, *SlotTaken,
// matchSlotsUsed) sont calculés ICI depuis la base ; le formulaire client ne
// fait que les afficher (§10, brief §4) — la server action recalcule tout de
// toute façon à l'écriture.

export type { TeamRef, BetCategory, BetDifficulty };

// Contexte d'entrée résolu côté page serveur (§2/§10).
export type NewBetContext = { mode: "FROM_MATCH"; matchId: string } | { mode: "FREE" };

export type MatchOption = {
  matchId: string;
  gameNumber: number;
  label: string; // « Match 2 — 25/07 21:00 » (Europe/Paris)
  isIdentified: boolean; // scheduled_at != null
  matchBetOpen: boolean; // identifié ET non commencé
  matchSlotTaken: boolean; // pari actif déjà posé sur ce match
};

export type SeriesOption = {
  seriesId: string;
  label: string; // « 1er tour — BOS vs MIA »
  team1Abbr: string | null;
  team2Abbr: string | null;
  seriesBetOpen: boolean; // 1er match non commencé (deadline série)
  seriesSlotTaken: boolean; // 1 pari SÉRIE actif déjà posé
  matchSlotsUsed: number; // slots MATCH consommés (Playoffs : 0..3)
  matchOptions: MatchOption[];
};

export type BetFormBootstrap = {
  competition: { id: string; kind: "PLAYOFFS" | "NBA_CUP" };
  categories: { value: BetCategory; label: string }[];
  seriesOptions: SeriesOption[];
};

// Pari en édition (DRAFT ou SUBMITTED du joueur) — §9/§10.
export type EditableBet = {
  betId: string;
  status: "DRAFT" | "SUBMITTED";
  scope: "SERIES" | "MATCH";
  seriesId: string;
  matchId: string | null;
  description: string;
  proposedCategory: BetCategory;
  proposedDifficulty: BetDifficulty;
};

export type NewBetFormData = {
  competitionId: string | null; // null = aucune compétition active
  bootstrap: BetFormBootstrap | null;
  context: NewBetContext;
  // Raccourci vers un match hors compétition, déjà commencé, ou inexistant
  // (§2) : retombe sur FREE, message discret, jamais une erreur bloquante.
  shortcutClosed: boolean;
};

export type EditBetFormData = {
  bet: EditableBet;
  bootstrap: BetFormBootstrap;
};

// Statuts de pari qui LIBÈRENT le slot (§6.3, simplification (b) actée) —
// même règle que lib/queries/matches.ts (RELEASED_BET_STATUSES) : un REJECTED
// libère TOUJOURS, faute de rejected_at ; un CANCELLED libère toujours.
const RELEASED_BET_STATUSES = new Set(["REJECTED", "CANCELLED"]);
const EDITABLE_BET_STATUSES = new Set(["DRAFT", "SUBMITTED"]);

export { MATCH_SLOT_CAP };

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };

type SeriesRow = {
  id: string;
  round: string;
  team1_id: string | null;
  team2_id: string | null;
};

type MatchRow = {
  id: string;
  series_id: string;
  game_number: number;
  scheduled_at: string | null;
};

type OwnBetRow = {
  id: string;
  scope: "SERIES" | "MATCH";
  series_id: string;
  match_id: string | null;
  status: string;
};

export async function getNewBetFormData(matchIdParam: string | null): Promise<NewBetFormData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Ne devrait pas se produire : le layout (app) garde déjà la session.
    return { competitionId: null, bootstrap: null, context: { mode: "FREE" }, shortcutClosed: false };
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    return { competitionId: null, bootstrap: null, context: { mode: "FREE" }, shortcutClosed: false };
  }

  const bootstrap = await buildBootstrap(supabase, user.id, competition);

  if (!matchIdParam) {
    return { competitionId: competition.id, bootstrap, context: { mode: "FREE" }, shortcutClosed: false };
  }

  const targetMatch = bootstrap.seriesOptions
    .flatMap((series) => series.matchOptions)
    .find((match) => match.matchId === matchIdParam);

  if (!targetMatch || !targetMatch.matchBetOpen) {
    // Match inexistant/hors compétition active, non identifié, ou déjà
    // commencé (§2) : retombe sur le contexte libre, pas une erreur bloquante.
    return { competitionId: competition.id, bootstrap, context: { mode: "FREE" }, shortcutClosed: true };
  }

  return {
    competitionId: competition.id,
    bootstrap,
    context: { mode: "FROM_MATCH", matchId: matchIdParam },
    shortcutClosed: false,
  };
}

export async function getEditBetFormData(betId: string): Promise<EditBetFormData | null> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: betRow } = await supabase
    .from("bets")
    .select("id, competition_id, user_id, scope, series_id, match_id, description, proposed_category, proposed_difficulty, status")
    .eq("id", betId)
    .maybeSingle<{
      id: string;
      competition_id: string;
      user_id: string;
      scope: "SERIES" | "MATCH";
      series_id: string;
      match_id: string | null;
      description: string;
      proposed_category: BetCategory;
      proposed_difficulty: BetDifficulty;
      status: string;
    }>();

  // Pas trouvé, pas le sien (la RLS peut révéler un pari public d'un autre
  // joueur à sa deadline, §5 T3 — non pertinent ici, propriétaire exigé), ou
  // statut non éditable sur CET écran (§9 : VALIDATED/REJECTED/WON/LOST/
  // CANCELLED → redirection "Mes paris", décidée par la page).
  if (!betRow || betRow.user_id !== user.id || !EDITABLE_BET_STATUSES.has(betRow.status)) {
    return null;
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("id", betRow.competition_id)
    .single<CompetitionRow>();

  if (!competition) return null;

  // Exclut CE pari de ses propres compteurs de slot (sinon il se compterait
  // lui-même comme "déjà pris" sur sa propre cible, figée de toute façon §9.2).
  const bootstrap = await buildBootstrap(supabase, user.id, competition, betRow.id);

  return {
    bet: {
      betId: betRow.id,
      status: betRow.status as "DRAFT" | "SUBMITTED",
      scope: betRow.scope,
      seriesId: betRow.series_id,
      matchId: betRow.match_id,
      description: betRow.description,
      proposedCategory: betRow.proposed_category,
      proposedDifficulty: betRow.proposed_difficulty,
    },
    bootstrap,
  };
}

async function buildBootstrap(
  supabase: SupabaseServerClient,
  userId: string,
  competition: CompetitionRow,
  excludeBetId?: string
): Promise<BetFormBootstrap> {
  const [{ data: seriesData }, { data: matchesData }, { data: ownBetsData }] = await Promise.all([
    supabase
      .from("series")
      .select("id, round, team1_id, team2_id")
      .eq("competition_id", competition.id),
    supabase
      .from("matches")
      .select("id, series_id, game_number, scheduled_at")
      .eq("competition_id", competition.id)
      .order("game_number", { ascending: true }),
    supabase
      .from("bets")
      .select("id, scope, series_id, match_id, status")
      .eq("user_id", userId)
      .eq("competition_id", competition.id),
  ]);

  const series = (seriesData ?? []) as SeriesRow[];
  const matches = (matchesData ?? []) as MatchRow[];
  const ownBets = ((ownBetsData ?? []) as OwnBetRow[]).filter((bet) => bet.id !== excludeBetId);

  // Abréviations d'équipe pour les libellés de série (§4.1) — une seule
  // requête `teams`, résolue avant de construire les libellés.
  const teamIds = [...new Set(series.flatMap((s) => [s.team1_id, s.team2_id]).filter((id): id is string => id !== null))];
  const { data: teamsData } =
    teamIds.length > 0
      ? await supabase.from("teams").select("id, abbreviation").in("id", teamIds)
      : { data: [] as { id: string; abbreviation: string }[] };
  const abbrevById = new Map((teamsData ?? []).map((t) => [t.id, t.abbreviation]));

  const matchesBySeries = new Map<string, MatchRow[]>();
  for (const match of matches) {
    const list = matchesBySeries.get(match.series_id) ?? [];
    list.push(match);
    matchesBySeries.set(match.series_id, list);
  }

  const activeSeriesBetIds = new Set(
    ownBets.filter((bet) => bet.scope === "SERIES" && !RELEASED_BET_STATUSES.has(bet.status)).map((bet) => bet.series_id)
  );
  const activeMatchBetIds = new Set(
    ownBets
      .filter((bet) => bet.scope === "MATCH" && !RELEASED_BET_STATUSES.has(bet.status) && bet.match_id)
      .map((bet) => bet.match_id as string)
  );
  const matchSlotsUsedBySeries = new Map<string, number>();
  for (const bet of ownBets) {
    if (bet.scope === "MATCH" && !RELEASED_BET_STATUSES.has(bet.status)) {
      matchSlotsUsedBySeries.set(bet.series_id, (matchSlotsUsedBySeries.get(bet.series_id) ?? 0) + 1);
    }
  }

  const nowMs = Date.now();
  const seriesOptions: SeriesOption[] = series.map((s) => {
    const seriesMatches = matchesBySeries.get(s.id) ?? [];
    // Reproduit public.bet_deadline_open(SERIES, ...) (T3 §2, même formule que
    // lib/queries/home.ts) : deadline = coup d'envoi du 1er match de la
    // série ; aucun match planifié -> pas encore ouverte au sens strict, mais
    // rien à fermer non plus (infini, cohérent avec la fonction DB).
    const firstScheduled = seriesMatches
      .map((m) => m.scheduled_at)
      .filter((v): v is string => v !== null)
      .sort()[0];
    const seriesBetOpen = firstScheduled ? Date.parse(firstScheduled) > nowMs : true;

    const matchOptions: MatchOption[] = seriesMatches
      .map((m) => {
        const isIdentified = m.scheduled_at !== null;
        const matchBetOpen = isIdentified && Date.parse(m.scheduled_at as string) > nowMs;
        return {
          matchId: m.id,
          gameNumber: m.game_number,
          label: matchLabel(m.game_number, m.scheduled_at),
          isIdentified,
          matchBetOpen,
          matchSlotTaken: activeMatchBetIds.has(m.id),
        };
      })
      .sort((a, b) => a.gameNumber - b.gameNumber);

    const team1Abbr = s.team1_id ? abbrevById.get(s.team1_id) ?? null : null;
    const team2Abbr = s.team2_id ? abbrevById.get(s.team2_id) ?? null : null;

    return {
      seriesId: s.id,
      label: seriesLabel(s, abbrevById),
      team1Abbr,
      team2Abbr,
      seriesBetOpen,
      seriesSlotTaken: activeSeriesBetIds.has(s.id),
      matchSlotsUsed: matchSlotsUsedBySeries.get(s.id) ?? 0,
      matchOptions,
    };
  });

  return {
    competition: { id: competition.id, kind: competition.type },
    categories: BET_CATEGORY_OPTIONS,
    seriesOptions,
  };
}

// Même règle que lib/queries/my-predictions.ts (seriesLabel) : libellé
// construit sur team1_id/team2_id, jamais sur les home/away d'un match qui
// peuvent être inversés d'un match à l'autre (§4.1).
function seriesLabel(s: SeriesRow, abbrevById: Map<string, string>): string {
  const round = ROUND_LABELS[s.round] ?? s.round;
  const team1 = s.team1_id ? abbrevById.get(s.team1_id) : undefined;
  const team2 = s.team2_id ? abbrevById.get(s.team2_id) : undefined;
  return team1 && team2 ? `${round} — ${team1} vs ${team2}` : round;
}

const MATCH_LABEL_TIMEZONE = "Europe/Paris";

function matchLabel(gameNumber: number, scheduledAt: string | null): string {
  if (!scheduledAt) return `Match ${gameNumber} — date à confirmer`;
  const date = new Date(scheduledAt);
  const datePart = new Intl.DateTimeFormat("fr-FR", {
    timeZone: MATCH_LABEL_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", {
    timeZone: MATCH_LABEL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `Match ${gameNumber} — ${datePart} ${timePart}`;
}
