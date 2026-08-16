import { getServerClient } from "@/lib/supabase/server";
import { ROUND_LABELS } from "@/lib/labels/rounds";
import { resolveLeagueScope } from "@/lib/queries/leagues";

// Lecture de l'écran Bracket (vue globale de consultation), composants
// serveur uniquement — SPEC_ECRAN_CLASSEMENT_BRACKET §15.2. Un seul module,
// appelé avec getServerClient() (jamais service_role) : la RLS reste seule
// autorité de visibilité, en particulier pour bracket_picks/brackets qui ne
// s'ouvrent qu'après bracket_deadline_passed() (T3 §4).
//
// IMPÉRATIF DE CONFIDENTIALITÉ (§15.2) : avant la deadline, `groups` et
// `players` sont VIDES CÔTÉ SERVEUR. Implémenté en ne lançant même pas les
// requêtes bracket_picks/brackets tant que isDeadlinePassed est faux — la
// confidentialité ne repose jamais sur un `if` de rendu.

/** Un joueur du groupe, avec son id pour le lien /players/[userId] (ajouté
 *  le 30/07/2026 — auparavant un simple pseudo, string). */
export type SeriesPickPlayer = { userId: string; pseudo: string };

/** Un groupe de joueurs ayant fait le même pronostic sur une série. */
export type SeriesPickGroup = {
  teamAbbreviation: string;
  seriesFormat: string | null; // null en NBA Cup (match sec)
  count: number;
  percentage: number | null; // null si ≤ 10 brackets remplis SUR CETTE SÉRIE
  players: SeriesPickPlayer[]; // VIDE avant la deadline
};

// Statut réel d'une série (14/08/2026, demandé par l'utilisateur — layout
// 2 colonnes + séries EN COURS mises en avant, le reste replié) — reflète
// directement series.official_status (déjà en base, déjà la seule source
// de vérité côté scoring, lib/scoring/engine.ts).
export type BracketSeriesStatus = "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";

/** Score EN DIRECT (victoires par équipe) — non-null UNIQUEMENT si status
 *  === "IN_PROGRESS". Snapshot au chargement de la page (pas de push
 *  Realtime ici, §18 : le live reste réservé à l'écran Matchs). */
export type BracketLiveScore = { teamAWins: number; teamBWins: number };

/** Le PRONOSTIC de bracket du joueur connecté sur ce nœud (15/08/2026,
 *  demandé par l'utilisateur — mise en avant très voyante directement sur la
 *  carte de série, cf. NodeCard.tsx ; distinct du PARI personnalisé, qui
 *  reste affiché sur Mes pronos, pas ici). Même garde de confidentialité que
 *  `groups` (§15.2) : UNIQUEMENT peuplé après la deadline, jamais avant —
 *  un pronostic non révélé aux autres ne doit pas non plus s'afficher en
 *  avant-première au joueur lui-même sur CET écran partagé. null pour un
 *  visiteur non connecté, ou un joueur sans pronostic complet sur ce nœud. */
export type BracketMyPick = {
  teamAbbreviation: string;
  seriesFormat: string | null; // null en NBA Cup (match sec)
};

/** Pilote le petit bouton « Parier »/« Modifier » sur chaque carte série
 *  (15/08/2026, demandé par l'utilisateur — Mes paris devient consultation
 *  seule, la proposition d'un pari SÉRIE se fait ici). PAS soumis à la garde
 *  de confidentialité de `groups`/`myPick` : mon propre pari m'est toujours
 *  visible, indépendamment de `bracket_deadline` (qui ne régit que les
 *  PRONOSTICS de bracket, pas les paris personnalisés). REJECTED/CANCELLED
 *  libèrent toujours le slot (0.2.4 §6, même règle que my-bets.ts) → PROPOSE.
 *  null = pari déjà VALIDATED/WON/LOST — engagé, rien à proposer ni modifier —
 *  OU série FINISHED/POSTPONED/CANCELLED (16/08/2026, bug d'audit corrigé) :
 *  n'accepte plus de pari, quel que soit l'état du pari existant. */
export type BracketMyBetAction = { kind: "PROPOSE" } | { kind: "EDIT"; betId: string };

export type BracketNode = {
  nodeId: string;
  round: string;
  conference: "EAST" | "WEST" | null; // null = finale croisée, ou NBA Cup
  teamA: { abbreviation: string; name: string } | null; // null = pas encore déterminé
  teamB: { abbreviation: string; name: string } | null;
  actualWinnerAbbreviation: string | null; // état réel
  status: BracketSeriesStatus;
  liveScore: BracketLiveScore | null;
  finalScoreFormat: string | null; // non-null uniquement si status === "FINISHED" (Playoffs)
  filledBracketsCount: number;
  groups: SeriesPickGroup[]; // VIDE avant la deadline
  myPick: BracketMyPick | null; // VIDE avant la deadline, même garde que groups
  myBetAction: BracketMyBetAction | null;
};

export type BracketRound = { key: string; label: string; nodes: BracketNode[] };

export type BracketData = {
  competitionId: string | null;
  competitionType: "PLAYOFFS" | "NBA_CUP";
  deadline: string | null; // ISO
  isDeadlinePassed: boolean; // pilote §13 (tendances + noms)
  isStructureKnown: boolean; // false = Cup avant qualification des 8
  rounds: BracketRound[];
  filledCount: number; // progression X/15 ou X/7
  totalCount: number;
  /** Filtre "qui a pris quoi" par ligue (30/07/2026, demandé par
   *  l'utilisateur) — null = Général. Filtre groups/players/
   *  filledBracketsCount (et le % qui en dérive), jamais l'état RÉEL du
   *  tournoi (actualWinnerAbbreviation, filledCount global). */
  scopeLeagueId: string | null;
  scopeLeagueName: string | null;
};

function emptyData(scopeLeagueId: string | null = null, scopeLeagueName: string | null = null): BracketData {
  return {
    competitionId: null,
    // Valeur inerte : jamais lue, la page teste competitionId === null d'abord.
    competitionType: "PLAYOFFS",
    deadline: null,
    isDeadlinePassed: false,
    isStructureKnown: false,
    rounds: [],
    filledCount: 0,
    totalCount: 0,
    scopeLeagueId,
    scopeLeagueName,
  };
}

const PLAYOFFS_ROUNDS = ["ROUND_1", "CONF_SEMIS", "CONF_FINALS", "NBA_FINALS"] as const;
const CUP_ROUNDS = ["CUP_QUARTERS", "CUP_SEMIS", "CUP_FINAL"] as const;

const CONFERENCE_RANK: Record<string, number> = { EAST: 0, WEST: 1 };

type CompetitionRow = {
  id: string;
  type: "PLAYOFFS" | "NBA_CUP";
  bracket_deadline: string | null;
};

type SeriesRow = {
  id: string;
  round: string;
  conference: "EAST" | "WEST" | null;
  slot_index: number;
  team1_id: string | null;
  team2_id: string | null;
  official_status: BracketSeriesStatus;
  official_winner_team_id: string | null;
  official_score_format: string | null;
};

type TeamRow = { id: string; name: string; abbreviation: string };

type OwnSeriesBetRow = { id: string; series_id: string; status: string };

export async function getBracket(leagueId?: string | null): Promise<BracketData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const scope = await resolveLeagueScope(supabase, leagueId);
  const scopeLeagueId = scope?.id ?? null;
  const scopeLeagueName = scope?.name ?? null;

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, type, bracket_deadline")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    return emptyData(scopeLeagueId, scopeLeagueName);
  }

  const deadline = competition.bracket_deadline;
  const isDeadlinePassed = deadline !== null && Date.parse(deadline) <= Date.now();

  const { data: seriesData } = await supabase
    .from("series")
    .select("id, round, conference, slot_index, team1_id, team2_id, official_status, official_winner_team_id, official_score_format")
    .eq("competition_id", competition.id);

  const series = (seriesData ?? []) as SeriesRow[];

  // NBA Cup avant qualification des 8 équipes : aucune série en base (même
  // convention que lib/queries/home.ts::getBracketTodo).
  const isStructureKnown = series.length > 0;
  if (!isStructureKnown) {
    return {
      competitionId: competition.id,
      competitionType: competition.type,
      deadline,
      isDeadlinePassed,
      isStructureKnown: false,
      rounds: [],
      filledCount: 0,
      totalCount: 0,
      scopeLeagueId,
      scopeLeagueName,
    };
  }

  const seriesIds = series.map((row) => row.id);

  const [{ data: teamsData }, { data: ownBetsData }] = await Promise.all([
    supabase.from("teams").select("id, name, abbreviation"),
    user
      ? supabase
          .from("bets")
          .select("id, series_id, status")
          .eq("user_id", user.id)
          .eq("competition_id", competition.id)
          .eq("scope", "SERIES")
          .in("series_id", seriesIds)
      : Promise.resolve({ data: [] as OwnSeriesBetRow[] }),
  ]);
  const teams = new Map(
    ((teamsData ?? []) as TeamRow[]).map((team) => [
      team.id,
      { name: team.name, abbreviation: team.abbreviation },
    ])
  );

  // Bouton Parier/Modifier (15/08/2026) : contrainte unique en base
  // (uniq_active_series_bet) → au plus UN pari actif (non libéré) par série.
  // REJECTED/CANCELLED sont exclus d'emblée (toujours libérés, 0.2.4 §6) —
  // absent de cette map = aucun pari actif = bouton "Parier" par défaut plus
  // bas ; présent = DRAFT/SUBMITTED (éditable, bouton "Modifier") ou
  // VALIDATED/WON/LOST (engagé, pas de bouton du tout).
  const RELEASED_SERIES_BET_STATUSES = new Set(["REJECTED", "CANCELLED"]);
  const EDITABLE_SERIES_BET_STATUSES = new Set(["DRAFT", "SUBMITTED"]);
  const activeBetBySeriesId = new Map<string, { betId: string; status: string }>();
  for (const row of (ownBetsData ?? []) as OwnSeriesBetRow[]) {
    if (RELEASED_SERIES_BET_STATUSES.has(row.status)) continue;
    activeBetBySeriesId.set(row.series_id, { betId: row.id, status: row.status });
  }

  // Correctif (16/08/2026, bug trouvé en audit) : une série TERMINÉE/
  // ANNULÉE/REPORTÉE n'accepte plus de pari — `BetForm.tsx::isSeriesSelectable`
  // le refuse déjà côté formulaire, mais `myBetAction` retombait quand même
  // sur PROPOSE par défaut ici, affichant un bouton "Parier" trompeur sur la
  // carte (cliquable, mais qui échoue une fois dans le formulaire).
  const NON_BETTABLE_SERIES_STATUSES = new Set<BracketSeriesStatus>(["FINISHED", "POSTPONED", "CANCELLED"]);

  // Ordre des nœuds en NBA Cup : « matchs ordonnés par coup d'envoi » (§14) —
  // besoin du 1er coup d'envoi par série (Cup = match sec, 1 match/série).
  const earliestKickoffBySeries = new Map<string, number>();
  if (competition.type === "NBA_CUP") {
    const { data: matches } = await supabase
      .from("matches")
      .select("series_id, scheduled_at")
      .eq("competition_id", competition.id)
      .not("scheduled_at", "is", null);
    for (const match of matches ?? []) {
      const seriesId = match.series_id as string;
      const scheduledMs = Date.parse(match.scheduled_at as string);
      const current = earliestKickoffBySeries.get(seriesId);
      if (current === undefined || scheduledMs < current) {
        earliestKickoffBySeries.set(seriesId, scheduledMs);
      }
    }
  }

  // Score EN DIRECT des séries IN_PROGRESS (14/08/2026) — victoires par
  // équipe, comptées depuis les matchs FINISHED de la série (même logique
  // de comptage que deriveSeriesOutcome, lib/scoring/engine.ts, mais on a
  // besoin ici du DÉTAIL par équipe, pas seulement de l'agrégat déjà écrit
  // dans official_*). Une seule requête, uniquement s'il y a au moins une
  // série IN_PROGRESS.
  const inProgressSeriesIds = series.filter((row) => row.official_status === "IN_PROGRESS").map((row) => row.id);
  const liveScoreBySeriesId = new Map<string, BracketLiveScore>();
  if (inProgressSeriesIds.length > 0) {
    const { data: liveMatches } = await supabase
      .from("matches")
      .select("series_id, home_team_id, away_team_id, home_score, away_score")
      .in("series_id", inProgressSeriesIds)
      .eq("status", "FINISHED");
    const seriesById = new Map(series.map((row) => [row.id, row]));
    for (const match of liveMatches ?? []) {
      const homeScore = match.home_score as number | null;
      const awayScore = match.away_score as number | null;
      if (homeScore === null || awayScore === null || homeScore === awayScore) continue; // anomalie, ignorée (§4)
      const winnerTeamId = homeScore > awayScore ? match.home_team_id : match.away_team_id;
      const parentSeries = seriesById.get(match.series_id as string);
      if (!winnerTeamId || !parentSeries) continue;
      const current = liveScoreBySeriesId.get(parentSeries.id) ?? { teamAWins: 0, teamBWins: 0 };
      if (winnerTeamId === parentSeries.team1_id) current.teamAWins += 1;
      else if (winnerTeamId === parentSeries.team2_id) current.teamBWins += 1;
      liveScoreBySeriesId.set(parentSeries.id, current);
    }
  }

  // Drill-down nominatif (§11) : uniquement après la deadline. Les requêtes
  // ne sont même pas lancées avant — la confidentialité n'est jamais un `if`
  // de rendu. myPicksBySeriesId (15/08/2026) suit la MÊME garde : le
  // pronostic du joueur ne s'affiche pas en avant-première sur cet écran
  // partagé, même si lui seul le connaît déjà.
  const { filledBySeriesId, groupsBySeriesId, myPicksBySeriesId } = isDeadlinePassed
    ? await getFilledPicksAndGroups(supabase, competition.id, competition.type, teams, scope?.memberUserIds ?? null, user?.id ?? null)
    : {
        filledBySeriesId: new Map<string, number>(),
        groupsBySeriesId: new Map<string, SeriesPickGroup[]>(),
        myPicksBySeriesId: new Map<string, BracketMyPick>(),
      };

  const roundOrder = competition.type === "PLAYOFFS" ? PLAYOFFS_ROUNDS : CUP_ROUNDS;

  const rounds: BracketRound[] = roundOrder
    .map((roundKey) => {
      const roundSeries = series
        .filter((row) => row.round === roundKey)
        .sort((a, b) =>
          competition.type === "PLAYOFFS"
            ? conferenceRank(a.conference) - conferenceRank(b.conference) || a.slot_index - b.slot_index
            : kickoff(earliestKickoffBySeries, a.id) - kickoff(earliestKickoffBySeries, b.id) ||
              a.slot_index - b.slot_index
        );

      const nodes: BracketNode[] = roundSeries.map((row) => ({
        nodeId: row.id,
        round: row.round,
        conference: row.conference,
        teamA: row.team1_id ? (teams.get(row.team1_id) ?? null) : null,
        teamB: row.team2_id ? (teams.get(row.team2_id) ?? null) : null,
        actualWinnerAbbreviation: row.official_winner_team_id
          ? (teams.get(row.official_winner_team_id)?.abbreviation ?? null)
          : null,
        status: row.official_status,
        liveScore: row.official_status === "IN_PROGRESS" ? (liveScoreBySeriesId.get(row.id) ?? { teamAWins: 0, teamBWins: 0 }) : null,
        finalScoreFormat: row.official_status === "FINISHED" ? row.official_score_format : null,
        filledBracketsCount: filledBySeriesId.get(row.id) ?? 0,
        groups: groupsBySeriesId.get(row.id) ?? [],
        myPick: myPicksBySeriesId.get(row.id) ?? null,
        myBetAction: (() => {
          if (NON_BETTABLE_SERIES_STATUSES.has(row.official_status)) return null;
          const activeBet = activeBetBySeriesId.get(row.id);
          if (!activeBet) return { kind: "PROPOSE" as const };
          return EDITABLE_SERIES_BET_STATUSES.has(activeBet.status)
            ? { kind: "EDIT" as const, betId: activeBet.betId }
            : null;
        })(),
      }));

      return { key: roundKey, label: ROUND_LABELS[roundKey], nodes };
    })
    .filter((round) => round.nodes.length > 0);

  // Progression X/15 ou X/7 (§10.1) : nombre de séries dont le résultat réel
  // est connu, sur le total de séries de la structure — état du TOURNOI, pas
  // du remplissage d'un bracket individuel (getBracket() n'a pas de userId).
  const filledCount = series.filter((row) => row.official_winner_team_id !== null).length;

  return {
    competitionId: competition.id,
    competitionType: competition.type,
    deadline,
    isDeadlinePassed,
    isStructureKnown: true,
    rounds,
    filledCount,
    totalCount: series.length,
    scopeLeagueId,
    scopeLeagueName,
  };
}

/** Amorce du live Realtime (T6c §2.2/§14.2, migration #14) — SÉPARÉE de
 *  BracketData/BracketNode (contrat figé §15.2, jamais touché) : ne porte que
 *  ce qu'un UPDATE brut sur `series` ne peut pas résoudre seul (l'id d'équipe
 *  → son abréviation). Requête dédiée, minuscule (une compétition ⇒ ≤ 15
 *  séries), plutôt que d'étendre le type gelé. */
export type SeriesLiveSeed = {
  seriesId: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAAbbreviation: string | null;
  teamBAbbreviation: string | null;
};

export async function getSeriesLiveSeed(competitionId: string): Promise<SeriesLiveSeed[]> {
  const supabase = await getServerClient();

  const { data: seriesData } = await supabase
    .from("series")
    .select("id, team1_id, team2_id")
    .eq("competition_id", competitionId);
  const series = (seriesData ?? []) as Pick<SeriesRow, "id" | "team1_id" | "team2_id">[];
  if (series.length === 0) return [];

  const { data: teamsData } = await supabase.from("teams").select("id, name, abbreviation");
  const teams = new Map(((teamsData ?? []) as TeamRow[]).map((team) => [team.id, team.abbreviation]));

  return series.map((row) => ({
    seriesId: row.id,
    teamAId: row.team1_id,
    teamBId: row.team2_id,
    teamAAbbreviation: row.team1_id ? (teams.get(row.team1_id) ?? null) : null,
    teamBAbbreviation: row.team2_id ? (teams.get(row.team2_id) ?? null) : null,
  }));
}

function conferenceRank(conference: "EAST" | "WEST" | null): number {
  return conference ? (CONFERENCE_RANK[conference] ?? 2) : 2;
}

function kickoff(map: Map<string, number>, seriesId: string): number {
  return map.get(seriesId) ?? Number.POSITIVE_INFINITY;
}

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

type BracketPickRow = {
  series_id: string;
  bracket_id: string;
  predicted_winner_team_id: string | null;
  predicted_score_format: string | null;
};

async function getFilledPicksAndGroups(
  supabase: SupabaseServerClient,
  competitionId: string,
  competitionType: "PLAYOFFS" | "NBA_CUP",
  teams: Map<string, { name: string; abbreviation: string }>,
  scopeMemberUserIds: Set<string> | null,
  currentUserId: string | null
): Promise<{
  filledBySeriesId: Map<string, number>;
  groupsBySeriesId: Map<string, SeriesPickGroup[]>;
  myPicksBySeriesId: Map<string, BracketMyPick>;
}> {
  const [{ data: picksData }, { data: bracketsData }] = await Promise.all([
    supabase
      .from("bracket_picks")
      .select("series_id, bracket_id, predicted_winner_team_id, predicted_score_format")
      .eq("competition_id", competitionId),
    supabase.from("brackets").select("id, user_id").eq("competition_id", competitionId),
  ]);

  const userIdByBracketId = new Map(
    (bracketsData ?? []).map((row) => [row.id as string, row.user_id as string])
  );
  const bracketUserIds = [...new Set(userIdByBracketId.values())];

  const { data: profiles } =
    bracketUserIds.length > 0
      ? await supabase.from("users").select("id, pseudo").in("id", bracketUserIds)
      : { data: [] as { id: string; pseudo: string }[] };
  const pseudoByUserId = new Map((profiles ?? []).map((row) => [row.id as string, row.pseudo as string]));

  // Un pick est « rempli » : vainqueur choisi, ET score de série choisi en
  // Playoffs (pas de score de série en Cup — même convention que
  // lib/queries/home.ts::getBracketTodo).
  const filledPicksAll = ((picksData ?? []) as BracketPickRow[]).filter(
    (pick) =>
      pick.predicted_winner_team_id !== null &&
      (competitionType === "NBA_CUP" || pick.predicted_score_format !== null)
  );

  // Portée ligue (30/07/2026, demandé par l'utilisateur) : filtré ICI, EN
  // AMONT — filledBySeriesId (dénominateur du %) ET les groupes en héritent
  // automatiquement, cohérent avec le choix confirmé (le % se recalcule sur
  // la ligue, pas sur tous les joueurs).
  const filledPicks = scopeMemberUserIds
    ? filledPicksAll.filter((pick) => {
        const userId = userIdByBracketId.get(pick.bracket_id);
        return userId !== undefined && scopeMemberUserIds.has(userId);
      })
    : filledPicksAll;

  const filledBySeriesId = new Map<string, number>();
  for (const pick of filledPicks) {
    filledBySeriesId.set(pick.series_id, (filledBySeriesId.get(pick.series_id) ?? 0) + 1);
  }

  // Mon propre pronostic (15/08/2026, demandé par l'utilisateur — affichage
  // très voyant, NodeCard.tsx) : cherché dans filledPicksAll, JAMAIS
  // filledPicks (qui reste filtré par la portée ligue — mon pronostic
  // s'affiche quelle que soit la ligue consultée, cf. commentaire d'en-tête
  // de BracketData.scopeLeagueId).
  const myBracketId = currentUserId
    ? [...userIdByBracketId.entries()].find(([, userId]) => userId === currentUserId)?.[0]
    : undefined;
  const myPicksBySeriesId = new Map<string, BracketMyPick>();
  if (myBracketId) {
    for (const pick of filledPicksAll) {
      if (pick.bracket_id !== myBracketId) continue;
      const team = teams.get(pick.predicted_winner_team_id!);
      myPicksBySeriesId.set(pick.series_id, {
        teamAbbreviation: team?.abbreviation ?? "?",
        seriesFormat: pick.predicted_score_format,
      });
    }
  }

  // Regroupement par pronostic (vainqueur + format), trié par effectif
  // décroissant (§11). Clé = série + équipe + format.
  const groupsBySeriesKey = new Map<string, SeriesPickGroup & { seriesId: string }>();
  for (const pick of filledPicks) {
    const userId = userIdByBracketId.get(pick.bracket_id);
    const pseudo = userId ? pseudoByUserId.get(userId) : undefined;
    if (!userId || !pseudo) continue; // pick orphelin (ne devrait pas arriver, garde défensive)
    const player: SeriesPickPlayer = { userId, pseudo };

    const team = teams.get(pick.predicted_winner_team_id!);
    const key = `${pick.series_id}::${pick.predicted_winner_team_id}::${pick.predicted_score_format ?? "-"}`;
    const existing = groupsBySeriesKey.get(key);
    if (existing) {
      existing.count += 1;
      existing.players.push(player);
    } else {
      groupsBySeriesKey.set(key, {
        seriesId: pick.series_id,
        teamAbbreviation: team?.abbreviation ?? "?",
        seriesFormat: pick.predicted_score_format,
        count: 1,
        percentage: null, // calculé ci-dessous une fois le dénominateur connu
        players: [player],
      });
    }
  }

  const groupsBySeriesId = new Map<string, SeriesPickGroup[]>();
  for (const group of groupsBySeriesKey.values()) {
    const denominator = filledBySeriesId.get(group.seriesId) ?? 0;
    // Seuil PAR SÉRIE (§12) : ≥ 11 brackets remplis sur CETTE série → %, sinon brut.
    const percentage = denominator >= 11 ? Math.round((group.count / denominator) * 100) : null;
    const { seriesId, ...rest } = group;
    const list = groupsBySeriesId.get(seriesId) ?? [];
    list.push({ ...rest, percentage, players: [...rest.players].sort((a, b) => a.pseudo.localeCompare(b.pseudo)) });
    groupsBySeriesId.set(seriesId, list);
  }
  for (const list of groupsBySeriesId.values()) {
    list.sort((a, b) => b.count - a.count);
  }

  return { filledBySeriesId, groupsBySeriesId, myPicksBySeriesId };
}
