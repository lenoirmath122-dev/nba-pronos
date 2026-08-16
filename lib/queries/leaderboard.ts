import { getServerClient } from "@/lib/supabase/server";
import { assignRanks } from "@/lib/scoring/ranking";
import { resolveLeagueScope } from "@/lib/queries/leagues";

// Lecture de l'écran Classement (composants serveur uniquement),
// SPEC_ECRAN_CLASSEMENT_BRACKET §15.1. Un seul module, appelé avec
// getServerClient() : les requêtes passent par la RLS (jamais service_role),
// qui reste seule autorité de visibilité. Le tri, le rang (TOUJOURS calculé
// sur Total) et le départage sont produits ICI ; components/leaderboard/*
// ne font que rendre les valeurs déjà calculées.

export type SortKey = "total" | "matches" | "bracket" | "bets" | "form";

// Bascule croissant/décroissant (14/08/2026, demandée par l'utilisateur
// après la migration des puces vers des en-têtes cliquables — comportement
// de tableur attendu, absent du 1er jet). "desc" = repli par défaut, même
// affichage qu'avant l'ajout de cette bascule (meilleur en premier).
export type SortDirection = "asc" | "desc";

// Tendance de rang (13/08/2026, BACKLOG_V1.md « Fun / esprit ligue entre
// potes ») : compare le rang du jour au dernier snapshot disponible
// (leaderboard_snapshots, cron quotidien — déjà utilisé par
// lib/queries/stats.ts::ProfileStatsEvolutionPoint, jamais encore affiché
// sur cet écran). "unavailable" = aucun snapshot antérieur pour ce joueur
// (nouveau dans le classement, OU la compétition n'a pas encore de recul) —
// délibérément PAS labellé "nouveau joueur", on ne peut pas distinguer les
// deux cas depuis cette seule table.
//
// `daysAgo` (16/08/2026, bug d'audit corrigé) : le dernier snapshot
// disponible est le plus RÉCENT avant aujourd'hui, pas forcément celui
// d'hier — si le cron quotidien rate un jour, il peut dater de plusieurs
// jours. Le label affiché (LeaderboardRow.tsx::trendTitle) prétendait
// pourtant toujours « Hier » ; `daysAgo` laisse l'UI dire la vérité.
export type RankTrend =
  | { kind: "up"; delta: number; previousRank: number; daysAgo: number }
  | { kind: "down"; delta: number; previousRank: number; daysAgo: number }
  | { kind: "flat"; previousRank: number; daysAgo: number }
  | { kind: "unavailable" };

export type LeaderboardRow = {
  userId: string;
  pseudo: string;
  rank: number; // TOUJOURS calculé sur Total ; ex-aequo = même rang (1,2,2,4)
  totalPoints: number;
  matchesPoints: number;
  bracketPoints: number;
  betsPoints: number;
  formPoints: number; // 7 jours glissants
  exactMarginsCount: number; // « dont Écarts » — expansion uniquement
  betsAttempted: number; // paris WON+LOST (résolus) — expansion uniquement, cf. scoreBet
  betsWon: number;
  betsAvgDifficulty: number | null; // moyenne de validated_difficulty sur les paris résolus ; null si betsAttempted = 0
  isInactive: boolean; // compte désactivé, points conservés
  adminCorrectionsCount: number; // 0 = aucun badge
  isCurrentUser: boolean; // pilote la barre « toi » collante
  // null = portée LIGUE active : leaderboard_snapshots ne stocke que le rang
  // GÉNÉRAL (même limite déjà actée sur RankEvolutionChart, lib/queries/
  // stats.ts) — comparer un rang de ligue au rang général d'hier n'aurait
  // aucun sens, donc pas affiché du tout dans ce cas plutôt que trompeur.
  rankTrend: RankTrend | null;
};

export type LeaderboardData = {
  competitionId: string | null; // null = aucune compétition active
  competitionName: string | null;
  sortKey: SortKey;
  sortDirection: SortDirection;
  rows: LeaderboardRow[]; // déjà triées selon sortKey/sortDirection, rang déjà calculé sur Total
  currentUserRank: number | null; // null = visiteur, ou joueur non classé
  rankedCount: number; // pilote le seuil de 20 de la barre collante
  // Vue filtrée par ligue (BACKLOG_V1.md « Système de ligue », migration #16) :
  // rang RECALCULÉ dans le groupe (décidé avec l'utilisateur, 30/07/2026), pas
  // le rang général conservé — `rows`/`rank`/`rankedCount` ci-dessus portent
  // déjà cette valeur recalculée quand `scopeLeagueId` est renseigné.
  scopeLeagueId: string | null; // null = classement Général
  scopeLeagueName: string | null;
};

function emptyData(sortKey: SortKey, sortDirection: SortDirection): LeaderboardData {
  return {
    competitionId: null,
    competitionName: null,
    sortKey,
    sortDirection,
    rows: [],
    currentUserRank: null,
    rankedCount: 0,
    scopeLeagueId: null,
    scopeLeagueName: null,
  };
}

const SNAPSHOT_TIMEZONE = "Europe/Paris";

// Même technique que lib/snapshots/leaderboardSnapshot.ts::todayKey
// (en-CA -> YYYY-MM-DD) — dupliquée plutôt que partagée, même raison que
// là-bas : fonction privée de 3 lignes, pas de module utilitaire de dates
// dans ce projet.
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SNAPSHOT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// `fromKey`/`toKey` : clés YYYY-MM-DD déjà résolues dans SNAPSHOT_TIMEZONE
// (todayKey()) — comparées comme des dates calendaires pures via Date.UTC,
// aucun souci de fuseau horaire puisqu'aucune des deux ne porte d'heure.
function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function computeRankTrend(currentRank: number, previousRank: number | undefined, daysAgo: number): RankTrend {
  if (previousRank === undefined) return { kind: "unavailable" };
  const delta = previousRank - currentRank; // positif = a progressé (rang NUMÉRIQUE plus petit)
  if (delta > 0) return { kind: "up", delta, previousRank, daysAgo };
  if (delta < 0) return { kind: "down", delta: Math.abs(delta), previousRank, daysAgo };
  return { kind: "flat", previousRank, daysAgo };
}

type CompetitionRow = { id: string; name: string };

type ScoreRow = {
  user_id: string;
  total_points: number;
  matches_points: number;
  bracket_points: number;
  bets_points: number;
  correct_match_winners: number;
  exact_margins: number;
  admin_corrections_count: number;
};

const SORT_ACCESSOR: Record<SortKey, (row: LeaderboardRow) => number> = {
  total: (row) => row.totalPoints,
  matches: (row) => row.matchesPoints,
  bracket: (row) => row.bracketPoints,
  bets: (row) => row.betsPoints,
  form: (row) => row.formPoints,
};

export async function getLeaderboard(
  sortKey: SortKey,
  leagueId?: string | null,
  sortDirection: SortDirection = "desc"
): Promise<LeaderboardData> {
  const supabase = await getServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Une seule compétition ACTIVE à la fois → aucune active = état vide global (§2).
  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle<CompetitionRow>();

  if (!competition) {
    // Le sélecteur de ligue reste affiché même sans compétition active
    // (demandé par l'utilisateur, 30/07/2026, trouvé en testant) : on
    // renvoie quand même l'id demandé pour que la puce corresponde,
    // même si aucun classement n'existe encore à filtrer.
    return { ...emptyData(sortKey, sortDirection), scopeLeagueId: leagueId ?? null };
  }

  // Ligue demandée (BACKLOG_V1.md « Système de ligue ») : un id invalide ou
  // une ligue dont on n'est pas membre retombe silencieusement sur le
  // classement Général, jamais une page vide surprenante (voir
  // resolveLeagueScope, lib/queries/leagues.ts).
  const scope = await resolveLeagueScope(supabase, leagueId);
  const scopeLeagueId = scope?.id ?? null;
  const scopeLeagueName = scope?.name ?? null;
  const scopeUserIds = scope?.memberUserIds ?? null;

  // user_scores : une ligne par (compétition, joueur) ayant au moins une ligne
  // de scoring — « jamais joué » est donc naturellement absent (§8), pas besoin
  // de partir de la table des joueurs. Vue security_invoker=false (migration #5,
  // 23/07/2026) : le classement agrégé est visible de tous, indépendamment de la
  // confidentialité par match/pari/pick qui reste inchangée sur les tables sources.
  const { data: scores } = await supabase
    .from("user_scores")
    .select(
      "user_id, total_points, matches_points, bracket_points, bets_points, correct_match_winners, exact_margins, admin_corrections_count"
    )
    .eq("competition_id", competition.id);

  const allScoreRows = (scores ?? []) as ScoreRow[];
  // Portée ligue : intersection avec les membres — rang recalculé PLUS BAS
  // (assignRanks tourne sur ce sous-ensemble, jamais sur le classement entier).
  const scoreRows = scopeUserIds
    ? allScoreRows.filter((row) => scopeUserIds!.has(row.user_id))
    : allScoreRows;

  if (scoreRows.length === 0) {
    return {
      competitionId: competition.id,
      competitionName: competition.name,
      sortKey,
      sortDirection,
      rows: [],
      currentUserRank: null,
      rankedCount: 0,
      scopeLeagueId,
      scopeLeagueName,
    };
  }

  const userIds = scoreRows.map((row) => row.user_id);

  // Tendance de rang : seulement en portée GÉNÉRALE (cf. commentaire de
  // RankTrend/rankTrend ci-dessus) — pas de requête inutile en portée ligue.
  const lastSnapshotDatePromise = scopeUserIds
    ? Promise.resolve(null)
    : supabase
        .from("leaderboard_snapshots")
        .select("snapshot_date")
        .eq("competition_id", competition.id)
        .lt("snapshot_date", todayKey())
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle<{ snapshot_date: string }>();

  const [{ data: profiles }, { data: forms }, { data: betsRows }, lastSnapshotDateResult] = await Promise.all([
    supabase.from("users").select("id, pseudo, status").in("id", userIds),
    supabase
      .from("user_recent_form")
      .select("user_id, recent_form_points")
      .eq("competition_id", competition.id)
      .in("user_id", userIds),
    // Paris résolus uniquement (WON/LOST, cf. scoreBet §8) : DRAFT/SUBMITTED/
    // VALIDATED/REJECTED ne sont pas encore jugés, CANCELLED n'a jamais eu
    // lieu — aucun des 3 ne compte comme « tenté » pour ce ratio (expansion).
    supabase
      .from("bets")
      .select("user_id, status, validated_difficulty, proposed_difficulty")
      .eq("competition_id", competition.id)
      .in("user_id", userIds)
      .in("status", ["WON", "LOST"]),
    lastSnapshotDatePromise,
  ]);

  type BetStat = { attempted: number; won: number; difficultySum: number };
  const betStatsByUser = new Map<string, BetStat>();
  for (const row of betsRows ?? []) {
    const userId = row.user_id as string;
    const stat = betStatsByUser.get(userId) ?? { attempted: 0, won: 0, difficultySum: 0 };
    stat.attempted += 1;
    if (row.status === "WON") stat.won += 1;
    // « validée fait foi », repli sur la proposée sinon (même convention que
    // my-bets.ts/stats.ts/player-profile.ts) : un LOST peut ne jamais avoir
    // été validé (recompute.test.ts) — proposed_difficulty, seule NOT NULL
    // en base, garantit qu'aucun pari résolu n'est perdu pour la moyenne.
    stat.difficultySum += (row.validated_difficulty as number | null) ?? (row.proposed_difficulty as number);
    betStatsByUser.set(userId, stat);
  }

  const profileById = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      { pseudo: row.pseudo as string, isInactive: row.status === "DISABLED" },
    ])
  );
  const formByUser = new Map(
    (forms ?? []).map((row) => [row.user_id as string, row.recent_form_points as number])
  );

  // 2e aller-retour nécessaire (date du dernier snapshot connue seulement
  // après la 1re requête) : toutes les lignes de CE jour-là, un seul appel
  // plutôt qu'un par joueur.
  const previousRankByUser = new Map<string, number>();
  const lastSnapshotDate = lastSnapshotDateResult?.data?.snapshot_date;
  const daysAgo = lastSnapshotDate ? daysBetween(lastSnapshotDate, todayKey()) : 0;
  if (lastSnapshotDate) {
    const { data: prevRows } = await supabase
      .from("leaderboard_snapshots")
      .select("user_id, rank")
      .eq("competition_id", competition.id)
      .eq("snapshot_date", lastSnapshotDate);
    for (const row of prevRows ?? []) {
      previousRankByUser.set(row.user_id as string, row.rank as number);
    }
  }

  const ranks = assignRanks(scoreRows);

  const rows: LeaderboardRow[] = scoreRows.map((row) => {
    const profile = profileById.get(row.user_id);
    const rank = ranks.get(row.user_id)!;
    const betStat = betStatsByUser.get(row.user_id);
    return {
      userId: row.user_id,
      pseudo: profile?.pseudo ?? "",
      rank,
      totalPoints: row.total_points,
      matchesPoints: row.matches_points,
      bracketPoints: row.bracket_points,
      betsPoints: row.bets_points,
      formPoints: formByUser.get(row.user_id) ?? 0,
      exactMarginsCount: row.exact_margins,
      betsAttempted: betStat?.attempted ?? 0,
      betsWon: betStat?.won ?? 0,
      betsAvgDifficulty: betStat && betStat.attempted > 0 ? betStat.difficultySum / betStat.attempted : null,
      isInactive: profile?.isInactive ?? false,
      adminCorrectionsCount: row.admin_corrections_count,
      isCurrentUser: row.user_id === user?.id,
      rankTrend: scopeUserIds ? null : computeRankTrend(rank, previousRankByUser.get(row.user_id), daysAgo),
    };
  });

  // La colonne active pilote l'ORDRE des lignes, jamais le rang (déjà figé
  // ci-dessus, §5). sortDirection (14/08/2026) inverse le comparateur EN
  // BLOC, départage compris — cliquer 2x sur un en-tête déjà actif inverse
  // proprement, sans réinventer un 2e critère de départage pour "asc".
  const directionSign = sortDirection === "asc" ? -1 : 1;
  const sortedRows = [...rows].sort(
    (a, b) => directionSign * (SORT_ACCESSOR[sortKey](b) - SORT_ACCESSOR[sortKey](a) || b.totalPoints - a.totalPoints)
  );

  const currentUserRow = user ? (rows.find((row) => row.userId === user.id) ?? null) : null;

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    sortKey,
    sortDirection,
    rows: sortedRows,
    currentUserRank: currentUserRow?.rank ?? null,
    rankedCount: rows.length,
    scopeLeagueId,
    scopeLeagueName,
  };
}
