import { getServerClient } from "@/lib/supabase/server";

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
};

function emptyData(sortKey: SortKey): LeaderboardData {
  return {
    competitionId: null,
    competitionName: null,
    sortKey,
    rows: [],
    currentUserRank: null,
    rankedCount: 0,
  };
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
};

// Départage du rang (0.2.6 §3, même ordre que lib/queries/home.ts) :
// 1. Total  2. bons vainqueurs de match  3. écarts exacts  4. points bracket.
function compareForRank(a: ScoreRow, b: ScoreRow): number {
  return (
    b.total_points - a.total_points ||
    b.correct_match_winners - a.correct_match_winners ||
    b.exact_margins - a.exact_margins ||
    b.bracket_points - a.bracket_points
  );
}

function sameRankKey(a: ScoreRow, b: ScoreRow): boolean {
  return (
    a.total_points === b.total_points &&
    a.correct_match_winners === b.correct_match_winners &&
    a.exact_margins === b.exact_margins &&
    a.bracket_points === b.bracket_points
  );
}

/** Ex-aequo : rang partagé, le rang suivant saute — numérotation 1, 2, 2, 4 (§9). */
function assignRanks(sortedByRank: ScoreRow[]): Map<string, number> {
  const ranks = new Map<string, number>();
  sortedByRank.forEach((row, index) => {
    const previous = sortedByRank[index - 1];
    const rank =
      index === 0 || !sameRankKey(row, previous) ? index + 1 : ranks.get(previous.user_id)!;
    ranks.set(row.user_id, rank);
  });
  return ranks;
}

const SORT_ACCESSOR: Record<SortKey, (row: LeaderboardRow) => number> = {
  total: (row) => row.totalPoints,
  matches: (row) => row.matchesPoints,
  bracket: (row) => row.bracketPoints,
  bets: (row) => row.betsPoints,
  form: (row) => row.formPoints,
};

export async function getLeaderboard(sortKey: SortKey): Promise<LeaderboardData> {
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

  // user_scores : une ligne par (compétition, joueur) ayant au moins une ligne
  // de scoring — « jamais joué » est donc naturellement absent (§8), pas besoin
  // de partir de la table des joueurs.
  const { data: scores } = await supabase
    .from("user_scores")
    .select(
      "user_id, total_points, matches_points, bracket_points, bets_points, correct_match_winners, exact_margins"
    )
    .eq("competition_id", competition.id);

  const scoreRows = (scores ?? []) as ScoreRow[];
  if (scoreRows.length === 0) {
    return {
      competitionId: competition.id,
      competitionName: competition.name,
      sortKey,
      rows: [],
      currentUserRank: null,
      rankedCount: 0,
    };
  }

  const userIds = scoreRows.map((row) => row.user_id);

  const [{ data: profiles }, { data: forms }, { data: correctedPredictions }, { data: correctedBets }] =
    await Promise.all([
      supabase.from("users").select("id, pseudo, status").in("id", userIds),
      supabase
        .from("user_recent_form")
        .select("user_id, recent_form_points")
        .eq("competition_id", competition.id)
        .in("user_id", userIds),
      // adminCorrectionsCount : agrégat sur match_predictions ET bets (§0/§7) —
      // un attribut du prono/du pari, jamais du joueur.
      supabase
        .from("match_predictions")
        .select("user_id")
        .eq("competition_id", competition.id)
        .eq("is_admin_corrected", true)
        .in("user_id", userIds),
      supabase
        .from("bets")
        .select("user_id")
        .eq("competition_id", competition.id)
        .eq("is_admin_corrected", true)
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

  const correctionCounts = new Map<string, number>();
  for (const row of [...(correctedPredictions ?? []), ...(correctedBets ?? [])]) {
    const userId = row.user_id as string;
    correctionCounts.set(userId, (correctionCounts.get(userId) ?? 0) + 1);
  }

  const ranks = assignRanks([...scoreRows].sort(compareForRank));

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
      adminCorrectionsCount: correctionCounts.get(row.user_id) ?? 0,
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
  };
}
