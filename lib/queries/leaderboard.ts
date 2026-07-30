import { getServerClient } from "@/lib/supabase/server";
import { assignRanks } from "@/lib/scoring/ranking";

// Lecture de l'écran Classement (composants serveur uniquement),
// SPEC_ECRAN_CLASSEMENT_BRACKET §15.1. Un seul module, appelé avec
// getServerClient() : les requêtes passent par la RLS (jamais service_role),
// qui reste seule autorité de visibilité. Le tri, le rang (TOUJOURS calculé
// sur Total) et le départage sont produits ICI ; components/leaderboard/*
// ne font que rendre les valeurs déjà calculées.

export type SortKey = "total" | "matches" | "bracket" | "bets" | "form";

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
  isInactive: boolean; // compte désactivé, points conservés
  adminCorrectionsCount: number; // 0 = aucun badge
  isCurrentUser: boolean; // pilote la barre « toi » collante
};

export type LeaderboardData = {
  competitionId: string | null; // null = aucune compétition active
  competitionName: string | null;
  sortKey: SortKey;
  rows: LeaderboardRow[]; // déjà triées selon sortKey, rang déjà calculé sur Total
  currentUserRank: number | null; // null = visiteur, ou joueur non classé
  rankedCount: number; // pilote le seuil de 20 de la barre collante
  // Vue filtrée par ligue (BACKLOG_V1.md « Système de ligue », migration #16) :
  // rang RECALCULÉ dans le groupe (décidé avec l'utilisateur, 30/07/2026), pas
  // le rang général conservé — `rows`/`rank`/`rankedCount` ci-dessus portent
  // déjà cette valeur recalculée quand `scopeLeagueId` est renseigné.
  scopeLeagueId: string | null; // null = classement Général
  scopeLeagueName: string | null;
};

function emptyData(sortKey: SortKey): LeaderboardData {
  return {
    competitionId: null,
    competitionName: null,
    sortKey,
    rows: [],
    currentUserRank: null,
    rankedCount: 0,
    scopeLeagueId: null,
    scopeLeagueName: null,
  };
}

type CompetitionRow = { id: string; name: string };
type LeagueRow = { id: string; name: string };

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
  leagueId?: string | null
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
    return emptyData(sortKey);
  }

  // Ligue demandée (BACKLOG_V1.md « Système de ligue ») : `leagues_select`/
  // `league_memberships_select` (migration #16) ne renvoient quelque chose que
  // si l'appelant est LUI-MÊME membre — un id invalide ou une ligue dont on
  // n'est pas membre retombe donc silencieusement sur le classement Général,
  // jamais une page vide surprenante.
  let scopeLeagueId: string | null = null;
  let scopeLeagueName: string | null = null;
  let scopeUserIds: Set<string> | null = null;

  if (leagueId) {
    const [{ data: league }, { data: members }] = await Promise.all([
      supabase.from("leagues").select("id, name").eq("id", leagueId).maybeSingle<LeagueRow>(),
      supabase.from("league_memberships").select("user_id").eq("league_id", leagueId),
    ]);

    if (league) {
      scopeLeagueId = league.id;
      scopeLeagueName = league.name;
      scopeUserIds = new Set((members ?? []).map((row) => row.user_id as string));
    }
  }

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
      rows: [],
      currentUserRank: null,
      rankedCount: 0,
      scopeLeagueId,
      scopeLeagueName,
    };
  }

  const userIds = scoreRows.map((row) => row.user_id);

  const [{ data: profiles }, { data: forms }] = await Promise.all([
    supabase.from("users").select("id, pseudo, status").in("id", userIds),
    supabase
      .from("user_recent_form")
      .select("user_id, recent_form_points")
      .eq("competition_id", competition.id)
      .in("user_id", userIds),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      { pseudo: row.pseudo as string, isInactive: row.status === "DISABLED" },
    ])
  );
  const formByUser = new Map(
    (forms ?? []).map((row) => [row.user_id as string, row.recent_form_points as number])
  );

  const ranks = assignRanks(scoreRows);

  const rows: LeaderboardRow[] = scoreRows.map((row) => {
    const profile = profileById.get(row.user_id);
    return {
      userId: row.user_id,
      pseudo: profile?.pseudo ?? "",
      rank: ranks.get(row.user_id)!,
      totalPoints: row.total_points,
      matchesPoints: row.matches_points,
      bracketPoints: row.bracket_points,
      betsPoints: row.bets_points,
      formPoints: formByUser.get(row.user_id) ?? 0,
      exactMarginsCount: row.exact_margins,
      isInactive: profile?.isInactive ?? false,
      adminCorrectionsCount: row.admin_corrections_count,
      isCurrentUser: row.user_id === user?.id,
    };
  });

  // La puce active pilote l'ORDRE des lignes, jamais le rang (déjà figé ci-dessus, §5).
  const sortedRows = [...rows].sort(
    (a, b) => SORT_ACCESSOR[sortKey](b) - SORT_ACCESSOR[sortKey](a) || b.totalPoints - a.totalPoints
  );

  const currentUserRow = user ? (rows.find((row) => row.userId === user.id) ?? null) : null;

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    sortKey,
    rows: sortedRows,
    currentUserRank: currentUserRow?.rank ?? null,
    rankedCount: rows.length,
    scopeLeagueId,
    scopeLeagueName,
  };
}
