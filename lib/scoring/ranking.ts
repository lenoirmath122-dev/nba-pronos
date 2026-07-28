// Départage du rang (0.2.6 §3) : Total, puis bons vainqueurs de match, puis
// écarts exacts, puis points bracket. PARTAGÉ entre le classement live
// (lib/queries/leaderboard.ts) et l'instantané figé à la clôture
// (lib/actions/admin-competitions.ts, competition_archives, lot 3/3
// « Gestion des compétitions ») — la même règle doit produire le même rang
// aux deux endroits, sinon une archive pourrait geler un classement
// différent de celui vu en direct juste avant la clôture.

export type RankableScore = {
  user_id: string;
  total_points: number;
  correct_match_winners: number;
  exact_margins: number;
  bracket_points: number;
};

function compareForRank(a: RankableScore, b: RankableScore): number {
  return (
    b.total_points - a.total_points ||
    b.correct_match_winners - a.correct_match_winners ||
    b.exact_margins - a.exact_margins ||
    b.bracket_points - a.bracket_points
  );
}

function sameRankKey(a: RankableScore, b: RankableScore): boolean {
  return (
    a.total_points === b.total_points &&
    a.correct_match_winners === b.correct_match_winners &&
    a.exact_margins === b.exact_margins &&
    a.bracket_points === b.bracket_points
  );
}

/** Ex-aequo : rang partagé, le rang suivant saute — numérotation 1, 2, 2, 4. */
export function assignRanks<T extends RankableScore>(rows: T[]): Map<string, number> {
  const sorted = [...rows].sort(compareForRank);
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    const rank = index === 0 || !sameRankKey(row, previous) ? index + 1 : ranks.get(previous.user_id)!;
    ranks.set(row.user_id, rank);
  });
  return ranks;
}
