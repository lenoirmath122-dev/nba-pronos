import { assignRanks, type RankableScore } from "@/lib/scoring/ranking";
import type { RecapPeriod } from "./period";

// Contenu des récaps (p3-10), cadré avec l'utilisateur le 05/10/2026 :
// - Toi : points gagnés, détail (bons vainqueurs, écarts exacts, paris),
//   rang et évolution, joueurs dépassés.
// - La compet' : qui a pris le plus de points, plus gros pari réussi ; en
//   hebdo, classement de la semaine (top 3 + ta place), plus grosse remontée,
//   sniper, et le « plus loufoque perdu ».
// - Scores de la nuit + débrief TrashTalk (p3-11).
//
// Points gagnés = total actuel - total du dernier snapshot quotidien avant la
// fenêtre (leaderboard_snapshots), PAS une somme sur scored_at : le moteur de
// barème réécrit scored_at à chaque recalcul (lib/scoring/recompute.ts, et
// les picks du bracket à chaque match de la série), la date ne dit donc pas
// quand les points sont tombés. Le snapshot, lui, est la même source que la
// « plus grosse remontée » des superlatifs.
//
// Module pur : toutes les lignes arrivent déjà lues (load.ts).

export type SnapshotRow = { user_id: string; rank: number; total_points: number };

export type ScoredBetRow = {
  user_id: string;
  description: string;
  status: "WON" | "LOST";
  validated_difficulty: number | null;
  calculated_proba: number | null;
  points_awarded: number | null;
};

export type ScoredPredictionRow = {
  user_id: string;
  is_winner_correct: boolean | null;
  margin_diff: number | null;
};

export type NightMatch = {
  id: string;
  label: string; // "BOS 112 - 104 NYK"
  articleUrl: string | null;
};

export type RecapPlayer = { userId: string; pseudo: string; value: number };

export type RecapBet = {
  userId: string;
  pseudo: string;
  description: string;
  difficulty: number | null;
  proba: number | null;
};

export type PlayerLine = {
  pseudo: string;
  pointsGained: number;
  rank: number;
  previousRank: number | null;
  predictionsScored: number;
  correctWinners: number;
  exactMargins: number;
  betsWon: number;
  betsLost: number;
};

export type CompetitionRecap = {
  period: RecapPeriod;
  players: Map<string, PlayerLine>;
  /** Rang de chacun au classement de la période (points gagnés). */
  periodRanks: Map<string, number>;
  topScorers: RecapPlayer[];
  bestBet: RecapBet | null;
  craziestLostBet: RecapBet | null;
  /** Hebdo seulement (vides en journalier). */
  weeklyTop: RecapPlayer[];
  biggestClimb: RecapPlayer[];
  sniper: RecapPlayer[];
  nightMatches: NightMatch[];
  /** Au moins un point marqué, un pari tranché ou un match terminé. */
  hasActivity: boolean;
};

export type BuildInput = {
  period: RecapPeriod;
  scores: RankableScore[];
  baseline: SnapshotRow[];
  pseudoById: Map<string, string>;
  predictions: ScoredPredictionRow[];
  bets: ScoredBetRow[];
  nightMatches: NightMatch[];
};

/** Tous les joueurs au maximum (ex-aequo crédités, même règle que les
 *  superlatifs) ; personne si le maximum est nul. */
function topTied(entries: RecapPlayer[]): RecapPlayer[] {
  const max = Math.max(0, ...entries.map((entry) => entry.value));
  if (max <= 0) return [];
  return entries.filter((entry) => entry.value === max);
}

/** Pari le plus audacieux : difficulté la plus haute, puis proba la plus
 *  faible (sans proba = classé après ceux qui en ont une). */
function compareAudacity(a: ScoredBetRow, b: ScoredBetRow): number {
  const difficulty = (b.validated_difficulty ?? 0) - (a.validated_difficulty ?? 0);
  if (difficulty !== 0) return difficulty;
  return (a.calculated_proba ?? 2) - (b.calculated_proba ?? 2);
}

function toRecapBet(bet: ScoredBetRow | undefined, pseudoById: Map<string, string>): RecapBet | null {
  if (!bet) return null;
  return {
    userId: bet.user_id,
    pseudo: pseudoById.get(bet.user_id) ?? "—",
    description: bet.description,
    difficulty: bet.validated_difficulty,
    proba: bet.calculated_proba,
  };
}

/** Rang partagé en cas d'égalité (1, 2, 2, 4), sur une valeur décroissante. */
function rankByValue(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((a, b) => b[1] - a[1]);
  const ranks = new Map<string, number>();
  sorted.forEach(([userId, value], index) => {
    const previous = sorted[index - 1];
    ranks.set(userId, previous && previous[1] === value ? ranks.get(previous[0])! : index + 1);
  });
  return ranks;
}

export function buildCompetitionRecap(input: BuildInput): CompetitionRecap {
  const { period, scores, baseline, pseudoById, predictions, bets, nightMatches } = input;
  const liveRanks = assignRanks(scores);
  const baselineById = new Map(baseline.map((row) => [row.user_id, row]));

  const players = new Map<string, PlayerLine>();
  for (const score of scores) {
    const before = baselineById.get(score.user_id);
    players.set(score.user_id, {
      pseudo: pseudoById.get(score.user_id) ?? "—",
      // Un joueur absent du snapshot de référence n'avait encore aucun point.
      pointsGained: Math.max(0, score.total_points - (before?.total_points ?? 0)),
      rank: liveRanks.get(score.user_id)!,
      previousRank: before?.rank ?? null,
      predictionsScored: 0,
      correctWinners: 0,
      exactMargins: 0,
      betsWon: 0,
      betsLost: 0,
    });
  }

  for (const prediction of predictions) {
    const line = players.get(prediction.user_id);
    if (!line) continue;
    line.predictionsScored += 1;
    if (prediction.is_winner_correct) line.correctWinners += 1;
    if (prediction.margin_diff === 0) line.exactMargins += 1;
  }
  for (const bet of bets) {
    const line = players.get(bet.user_id);
    if (!line) continue;
    if (bet.status === "WON") line.betsWon += 1;
    else line.betsLost += 1;
  }

  const entries = (valueOf: (line: PlayerLine) => number): RecapPlayer[] =>
    [...players.entries()].map(([userId, line]) => ({ userId, pseudo: line.pseudo, value: valueOf(line) }));

  const periodRanks = rankByValue(new Map([...players.entries()].map(([userId, line]) => [userId, line.pointsGained])));
  const weekly = period.kind === "WEEKLY";

  const won = bets.filter((bet) => bet.status === "WON").sort(compareAudacity);
  const lost = bets.filter((bet) => bet.status === "LOST").sort(compareAudacity);

  return {
    period,
    players,
    periodRanks,
    topScorers: topTied(entries((line) => line.pointsGained)),
    bestBet: toRecapBet(won[0], pseudoById),
    craziestLostBet: weekly ? toRecapBet(lost[0], pseudoById) : null,
    weeklyTop: weekly
      ? entries((line) => line.pointsGained)
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
      : [],
    biggestClimb: weekly
      ? topTied(entries((line) => (line.previousRank === null ? 0 : line.previousRank - line.rank)))
      : [],
    sniper: weekly ? topTied(entries((line) => line.exactMargins)) : [],
    nightMatches,
    hasActivity:
      nightMatches.length > 0 || bets.length > 0 || [...players.values()].some((line) => line.pointsGained > 0),
  };
}

export type PersonalRecap = {
  pointsGained: number;
  rank: number | null;
  /** Places gagnées (positif) ou perdues (négatif) ; null sans rang de référence. */
  rankDelta: number | null;
  /** Joueurs qui étaient devant et sont maintenant derrière. */
  passed: string[];
  correctWinners: number;
  exactMargins: number;
  betsWon: number;
  betsLost: number;
  /** Place au classement de la période (hebdo : classement de la semaine). */
  periodRank: number | null;
  /** Le joueur a-t-il eu quelque chose de tranché sur la période ? */
  played: boolean;
};

export function personalRecap(recap: CompetitionRecap, userId: string): PersonalRecap | null {
  const me = recap.players.get(userId);
  if (!me) return null;

  const passed =
    me.previousRank === null
      ? []
      : [...recap.players.entries()]
          .filter(
            ([otherId, other]) =>
              otherId !== userId && other.previousRank !== null && other.previousRank < me.previousRank! && other.rank > me.rank
          )
          .map(([, other]) => other.pseudo);

  return {
    pointsGained: me.pointsGained,
    rank: me.rank,
    rankDelta: me.previousRank === null ? null : me.previousRank - me.rank,
    passed,
    correctWinners: me.correctWinners,
    exactMargins: me.exactMargins,
    betsWon: me.betsWon,
    betsLost: me.betsLost,
    periodRank: me.pointsGained > 0 ? recap.periodRanks.get(userId) ?? null : null,
    played: me.pointsGained > 0 || me.predictionsScored + me.betsWon + me.betsLost > 0,
  };
}
