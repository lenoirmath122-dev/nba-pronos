import { getServerClient } from "@/lib/supabase/server";

// Lecture de l'écran Matchs (composants serveur uniquement), SPEC_ECRAN_MATCHS
// §13. Un seul module, appelé avec getServerClient() (jamais service_role) :
// la RLS reste seule autorité de visibilité pour le CONTENU (others/absentees).
// Le regroupement par jour, le tri, la dérivation de viewStatus et le calcul
// des slots de paris sont faits ICI ; components/matches/* ne font que rendre.

export type TeamRef = { id: string; abbreviation: string; name: string };

export type PredictionViewStatus = "TODO" | "INCOMPLETE" | "READY" | "VALIDATED";

/** Prono d'un AUTRE joueur, révélé seulement quand isRevealed. */
export type OtherPrediction = {
  pseudo: string;
  teamAbbreviation: string;
  margin: number;
  isAdminCorrected: boolean;
  isInactive: boolean;
};

/** Indicateur du raccourci pari — §10. */
export type BetSlotIndicator =
  | { mode: "BINARY"; hasBetOnThisMatch: boolean }
  | { mode: "SERIES_QUOTA"; hasBetOnThisMatch: boolean; usedSlots: number; totalSlots: 3 };

export type MatchCard = {
  matchId: string;
  seriesId: string;
  scheduledAt: string; // ISO ; jamais null dans cette fenêtre (§2)
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  myWinnerTeamId: string | null; // null = pas encore choisi
  myMargin: number | null; // null = CASE VIDE (§6), jamais 0, jamais pré-rempli
  viewStatus: PredictionViewStatus;
  predictedCount: number; // X du compteur
  eligibleCount: number; // N du compteur — joueurs ACTIVE uniquement (§18.4)
  isRevealed: boolean; // calculé serveur, jamais côté rendu
  others: OtherPrediction[]; // VIDE si !isRevealed
  absentees: string[]; // VIDE si !isRevealed
  betSlot: BetSlotIndicator;
};

export type MatchDay = {
  key: string; // date locale, clé de regroupement
  label: string; // « Ce soir », « Demain », « Samedi 25 »
  matches: MatchCard[]; // triés par scheduledAt croissant
};

export type MatchesData = {
  competitionId: string | null; // null = aucune compétition active
  competitionType: "PLAYOFFS" | "NBA_CUP";
  days: MatchDay[]; // déjà triés, plus proche en premier
  readyCount: number; // pilote le bandeau « Tout valider » (§9)
};

const WINDOW_DAYS = 3;
// Groupement/libellés de jour en repère FRANCE (aucune convention de fuseau
// n'existe encore ailleurs dans le code ; Europe/Paris choisi explicitement
// plutôt que le fuseau machine du serveur, qui peut être UTC en hébergement).
const DAY_TIMEZONE = "Europe/Paris";
// Statuts de pari qui LIBÈRENT le slot (§10) — REJECTED toujours libéré ici :
// aucune colonne ne capture la date de rejet (pas de rejectBet codé, lot
// « Paris »), et sealDeadlines auto-valide tout SUBMITTED à la deadline, donc
// « rejeté après deadline » est un cas limite hors du fonctionnement normal.
const RELEASED_BET_STATUSES = new Set(["REJECTED", "CANCELLED"]);

function emptyData(): MatchesData {
  return {
    competitionId: null,
    // Valeur inerte : jamais lue, la page teste competitionId === null d'abord.
    competitionType: "PLAYOFFS",
    days: [],
    readyCount: 0,
  };
}

type CompetitionRow = { id: string; type: "PLAYOFFS" | "NBA_CUP" };

type MatchRow = {
  id: string;
  series_id: string;
  scheduled_at: string;
  home_team_id: string | null;
  away_team_id: string | null;
};

type TeamRow = { id: string; name: string; abbreviation: string };

type OwnPredictionRow = {
  match_id: string;
  predicted_winner_team_id: string | null;
  predicted_margin: number | null;
  status: "DRAFT" | "VALIDATED" | "LOCKED";
};

type OwnBetRow = {
  match_id: string | null;
  series_id: string;
  scope: "SERIES" | "MATCH";
  status: string;
};

type ActiveUserRow = { id: string; pseudo: string };

export async function getMatches(): Promise<MatchesData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Ne devrait pas se produire : le layout (app) garde déjà la session.
    return emptyData();
  }

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    return emptyData();
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowEndIso = new Date(nowMs + WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Fenêtre sur scheduled_at UNIQUEMENT, jamais sur matches.status (§2/§18.2) —
  // le planificateur (30-60 min) laisse un match commencé en SCHEDULED en base
  // près d'une heure ; filtrer sur le statut ferait déborder ou disparaître des
  // matchs au mauvais moment.
  const { data: matchesData } = await supabase
    .from("matches")
    .select("id, series_id, scheduled_at, home_team_id, away_team_id")
    .eq("competition_id", competition.id)
    .not("scheduled_at", "is", null)
    .gt("scheduled_at", nowIso)
    .lte("scheduled_at", windowEndIso)
    .order("scheduled_at", { ascending: true });

  const matches = (matchesData ?? []) as MatchRow[];
  if (matches.length === 0) {
    return { competitionId: competition.id, competitionType: competition.type, days: [], readyCount: 0 };
  }

  const matchIds = matches.map((m) => m.id);
  const seriesIds = [...new Set(matches.map((m) => m.series_id))];

  const [
    { data: teamsData },
    { data: ownPredictionsData },
    { data: ownBetsData },
    { data: activeUsersData },
    { data: isAdminData },
  ] = await Promise.all([
    supabase.from("teams").select("id, name, abbreviation"),
    supabase
      .from("match_predictions")
      .select("match_id, predicted_winner_team_id, predicted_margin, status")
      .eq("user_id", user.id)
      .in("match_id", matchIds),
    supabase
      .from("bets")
      .select("match_id, series_id, scope, status")
      .eq("user_id", user.id)
      .eq("competition_id", competition.id)
      .eq("scope", "MATCH")
      .in("series_id", seriesIds),
    supabase.from("users").select("id, pseudo").eq("status", "ACTIVE"),
    supabase.rpc("is_admin"),
  ]);

  const teams = new Map(
    ((teamsData ?? []) as TeamRow[]).map((t) => [t.id, { id: t.id, abbreviation: t.abbreviation, name: t.name }])
  );
  const ownPredictionByMatch = new Map(
    ((ownPredictionsData ?? []) as OwnPredictionRow[]).map((row) => [row.match_id, row])
  );
  const ownBets = (ownBetsData ?? []) as OwnBetRow[];
  const activeUsers = (activeUsersData ?? []) as ActiveUserRow[];
  const eligibleCount = activeUsers.length;
  const isAdmin = Boolean(isAdminData);

  // predictedCount (X) : fonction SECURITY DEFINER (migration #6) — un simple
  // count() en session joueur sous-compterait tant que l'appelant n'a pas
  // lui-même validé sur CE match précis (même RLS que has_committed_prediction).
  const predictedCounts = await Promise.all(
    matches.map((m) => supabase.rpc("count_committed_predictions", { p_match: m.id }))
  );
  const predictedCountByMatch = new Map(matches.map((m, i) => [m.id, (predictedCounts[i].data as number) ?? 0]));

  // Slots de paris consommés par série (Playoffs) — §10, calculé côté serveur.
  const usedSlotsBySeries = new Map<string, number>();
  const betByMatch = new Map<string, OwnBetRow>();
  for (const bet of ownBets) {
    if (!RELEASED_BET_STATUSES.has(bet.status)) {
      usedSlotsBySeries.set(bet.series_id, (usedSlotsBySeries.get(bet.series_id) ?? 0) + 1);
    }
    if (bet.match_id) betByMatch.set(bet.match_id, bet);
  }

  const cards: MatchCard[] = [];
  for (const match of matches) {
    const own = ownPredictionByMatch.get(match.id);
    const viewStatus = deriveViewStatus(own);
    const isRevealed = isAdmin || own?.status === "VALIDATED";

    // Confidentialité dans la requête, pas dans le rendu (§8, patron getBracket) :
    // others/absentees ne sont même pas demandés tant que isRevealed est faux.
    // La RLS (has_committed_prediction) bloquerait de toute façon ; le code ne
    // s'y fie pas seul.
    const { others, absentees } = isRevealed
      ? await getRevealedContent(supabase, match.id, user.id, activeUsers, teams)
      : { others: [] as OtherPrediction[], absentees: [] as string[] };

    const homeTeam = match.home_team_id ? teams.get(match.home_team_id) : undefined;
    const awayTeam = match.away_team_id ? teams.get(match.away_team_id) : undefined;
    if (!homeTeam || !awayTeam) continue; // garde défensive, ne devrait pas arriver (FK not null en pratique)

    const ownBet = betByMatch.get(match.id);
    const hasBetOnThisMatch = Boolean(ownBet && !RELEASED_BET_STATUSES.has(ownBet.status));
    const betSlot: BetSlotIndicator =
      competition.type === "NBA_CUP"
        ? { mode: "BINARY", hasBetOnThisMatch }
        : {
            mode: "SERIES_QUOTA",
            hasBetOnThisMatch,
            usedSlots: usedSlotsBySeries.get(match.series_id) ?? 0,
            totalSlots: 3,
          };

    cards.push({
      matchId: match.id,
      seriesId: match.series_id,
      scheduledAt: match.scheduled_at,
      homeTeam,
      awayTeam,
      myWinnerTeamId: own?.predicted_winner_team_id ?? null,
      myMargin: own?.predicted_margin ?? null,
      viewStatus,
      predictedCount: predictedCountByMatch.get(match.id) ?? 0,
      eligibleCount,
      isRevealed,
      others,
      absentees,
      betSlot,
    });
  }

  const days = groupByDay(cards, nowMs);
  const readyCount = cards.filter((c) => c.viewStatus === "READY").length;

  return { competitionId: competition.id, competitionType: competition.type, days, readyCount };
}

function deriveViewStatus(own: OwnPredictionRow | undefined): PredictionViewStatus {
  if (!own) return "TODO";
  if (own.status === "VALIDATED") return "VALIDATED";
  const fieldsSet = (own.predicted_winner_team_id !== null ? 1 : 0) + (own.predicted_margin !== null ? 1 : 0);
  return fieldsSet === 2 ? "READY" : "INCOMPLETE";
}

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

async function getRevealedContent(
  supabase: SupabaseServerClient,
  matchId: string,
  ownUserId: string,
  activeUsers: ActiveUserRow[],
  teams: Map<string, TeamRef>
): Promise<{ others: OtherPrediction[]; absentees: string[] }> {
  const { data: rowsData } = await supabase
    .from("match_predictions")
    .select("user_id, predicted_winner_team_id, predicted_margin, is_admin_corrected")
    .eq("match_id", matchId)
    .neq("status", "DRAFT");

  type Row = {
    user_id: string;
    predicted_winner_team_id: string | null;
    predicted_margin: number | null;
    is_admin_corrected: boolean;
  };
  const rows = (rowsData ?? []) as Row[];
  const committedUserIds = new Set(rows.map((r) => r.user_id));

  const userIds = rows.map((r) => r.user_id);
  const { data: profilesData } =
    userIds.length > 0
      ? await supabase.from("users").select("id, pseudo, status").in("id", userIds)
      : { data: [] as { id: string; pseudo: string; status: string }[] };
  const profileById = new Map((profilesData ?? []).map((p) => [p.id, p]));

  const others: OtherPrediction[] = rows
    .filter((row) => row.user_id !== ownUserId)
    .map((row) => {
      const profile = profileById.get(row.user_id);
      const team = row.predicted_winner_team_id ? teams.get(row.predicted_winner_team_id) : undefined;
      return {
        pseudo: profile?.pseudo ?? "",
        teamAbbreviation: team?.abbreviation ?? "?",
        margin: row.predicted_margin ?? 0,
        isAdminCorrected: row.is_admin_corrected,
        isInactive: profile?.status === "DISABLED",
      };
    })
    .sort((a, b) => a.pseudo.localeCompare(b.pseudo));

  // Absents : joueurs ACTIVE (même pool que N, §18.4) sans ligne engagée.
  const absentees = activeUsers
    .filter((u) => !committedUserIds.has(u.id))
    .map((u) => u.pseudo)
    .sort((a, b) => a.localeCompare(b));

  return { others, absentees };
}

function groupByDay(cards: MatchCard[], nowMs: number): MatchDay[] {
  const todayKey = localDateKey(nowMs);
  const tomorrowKey = localDateKey(nowMs + 24 * 60 * 60 * 1000);

  const groups = new Map<string, MatchDay>();
  for (const card of cards) {
    const cardMs = Date.parse(card.scheduledAt);
    const key = localDateKey(cardMs);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(key, todayKey, tomorrowKey, cardMs), matches: [] };
      groups.set(key, group);
    }
    group.matches.push(card);
  }
  // cards déjà triées par scheduledAt croissant (requête) -> l'ordre d'insertion
  // des groupes est déjà chronologique.
  return [...groups.values()];
}

function localDateKey(ms: number): string {
  // en-CA formate en YYYY-MM-DD (ordre lexicographique = ordre chronologique).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string, ms: number): string {
  if (key === todayKey) return "Ce soir";
  if (key === tomorrowKey) return "Demain";
  const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: DAY_TIMEZONE, weekday: "long" }).format(new Date(ms));
  const dayNum = new Intl.DateTimeFormat("fr-FR", { timeZone: DAY_TIMEZONE, day: "numeric" }).format(new Date(ms));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayNum}`;
}
