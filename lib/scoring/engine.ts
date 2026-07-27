// Moteur de scoring PUR (SPEC_TECHNIQUE_SCORING_V0_1 §3-§9) — AUCUNE I/O,
// AUCUN appel réseau, AUCUNE dépendance sur getServerClient/next-headers
// (C-3). Entrées = données officielles figées + prédictions ; sorties =
// colonnes de points à écrire (P5 : réécrites en entier à chaque passe,
// jamais accumulées ; P6 : jamais de valeur négative).
//
// L'orchestration (lecture/écriture DB, transactions, déclencheurs) vit
// dans lib/scoring/recompute.ts — jamais ici.

// ── Types d'entrée (§3) ──────────────────────────────────────────────────

export type MatchStatusValue = "SCHEDULED" | "IN_PROGRESS" | "FINISHED" | "POSTPONED" | "CANCELLED";
export type SeriesStatusValue = MatchStatusValue;
export type SeriesFormatValue = "4-0" | "4-1" | "4-2" | "4-3";
export type PlayoffRoundValue =
  | "ROUND_1"
  | "CONF_SEMIS"
  | "CONF_FINALS"
  | "NBA_FINALS"
  | "CUP_QUARTERS"
  | "CUP_SEMIS"
  | "CUP_FINAL";
export type CompetitionTypeValue = "PLAYOFFS" | "NBA_CUP";
export type BetStatusValue = "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED" | "WON" | "LOST" | "CANCELLED";

/** Résultat officiel figé d'un match (scores DÉJÀ sommés par C-1, T5 §1 A6). */
export type OfficialMatch = {
  id: string;
  status: MatchStatusValue;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
};

/** Agrégat officiel d'une série, DÉRIVÉ des matchs (§4). */
export type SeriesOutcome = {
  status: SeriesStatusValue;
  winnerTeamId: string | null;
  scoreFormat: SeriesFormatValue | null; // NULL en Cup
};

// ── Types de sortie (§3) — écrites EN ENTIER à chaque passe (P5) ────────

export type MatchPredictionScore = {
  isWinnerCorrect: boolean | null; // NULL = non scoré / neutralisé
  marginDiff: number | null;
  winnerPoints: number | null;
  marginBonusPoints: number | null;
};

export type BracketPickScore = {
  isWinnerCorrect: boolean | null;
  isScoreExact: boolean | null; // toujours NULL en Cup
  isMatchupCorrect: boolean | null;
  winnerPoints: number | null;
  exactScorePoints: number | null; // toujours NULL en Cup
  matchupPoints: number | null;
};

export type BetScore = { pointsAwarded: number | null };

// ── §4 — Dérivation de l'agrégat de série ────────────────────────────────

/**
 * Calcule l'agrégat OFFICIEL d'une série depuis SES matchs (best-of-7
 * Playoffs, ou l'unique match Cup). PURE : ne connaît PAS le statut
 * actuellement stocké en base — le respect d'un CANCELLED/POSTPONED déjà
 * posé par un admin (§4, "renvoyé tel quel") est un garde-fou de
 * l'ORCHESTRATION (lib/scoring/recompute.ts), pas de cette fonction : le
 * signature §3 ne prend que matches+competitionType, aucun statut existant
 * — interprétation actée pour cette implémentation (la prose de §4 est plus
 * un résumé produit qu'une description littérale de cette fonction précise).
 */
export function deriveSeriesOutcome(
  matches: OfficialMatch[],
  competitionType: CompetitionTypeValue
): SeriesOutcome {
  if (competitionType === "NBA_CUP") {
    const match = matches[0];
    if (!match) return { status: "SCHEDULED", winnerTeamId: null, scoreFormat: null };
    const winnerTeamId = match.status === "FINISHED" ? matchWinnerTeamId(match) : null;
    return { status: match.status, winnerTeamId, scoreFormat: null };
  }

  // PLAYOFFS (best-of-7) — §4.
  const finished = matches.filter((m) => m.status === "FINISHED");
  if (finished.length === 0) {
    return { status: "SCHEDULED", winnerTeamId: null, scoreFormat: null };
  }

  const wins = new Map<string, number>();
  for (const match of finished) {
    const winnerId = matchWinnerTeamId(match);
    if (winnerId) wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1);
  }

  const clinchedEntry = [...wins.entries()].find(([, count]) => count >= 4);
  if (!clinchedEntry) {
    return { status: "IN_PROGRESS", winnerTeamId: null, scoreFormat: null };
  }

  const [winnerTeamId, winnerWins] = clinchedEntry;
  // Somme des victoires des 2 équipes de la série = nb de matchs FINISHED
  // (exactement 2 équipes s'affrontent) — pas besoin d'identifier l'autre
  // équipe par id pour en déduire son nombre de victoires.
  const loserWins = finished.length - winnerWins;
  return { status: "FINISHED", winnerTeamId, scoreFormat: `4-${loserWins}` as SeriesFormatValue };
}

/** NBA ne connaît pas le nul (T5 §4) : une égalité est une ANOMALIE de
 *  données, jamais un cas nominal — journalisée, jamais devinée. */
function matchWinnerTeamId(match: OfficialMatch): string | null {
  if (match.homeScore === null || match.awayScore === null || !match.homeTeamId || !match.awayTeamId) {
    console.error(`scoring: match ${match.id} FINISHED sans score/équipe complet — anomalie ignorée`);
    return null;
  }
  if (match.homeScore === match.awayScore) {
    console.error(`scoring: match ${match.id} FINISHED à égalité (${match.homeScore}-${match.awayScore}) — anomalie`);
    return null;
  }
  return match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId;
}

// ── §5 — Barème MATCH (pronos) ───────────────────────────────────────────

const NEUTRALIZED_MATCH_PREDICTION: MatchPredictionScore = {
  isWinnerCorrect: null,
  marginDiff: null,
  winnerPoints: 0,
  marginBonusPoints: 0,
};

const ABSENT_MATCH_PREDICTION: MatchPredictionScore = {
  isWinnerCorrect: null,
  marginDiff: null,
  winnerPoints: null,
  marginBonusPoints: null,
};

function marginBonusFor(marginDiff: number): number {
  if (marginDiff === 0) return 5;
  if (marginDiff <= 2) return 3;
  if (marginDiff <= 5) return 2;
  if (marginDiff <= 9) return 1;
  return 0;
}

export function scoreMatchPrediction(
  prediction: { predictedWinnerTeamId: string | null; predictedMargin: number | null; isFrozen: boolean },
  match: OfficialMatch
): MatchPredictionScore {
  // Neutralisation A2 : inconditionnelle, même si le prono n'a jamais été
  // rempli/figé — "0 pour tous, aucune pénalité" (§5/§9.1), pas seulement
  // pour ceux qui avaient complété.
  if (match.status === "CANCELLED") return NEUTRALIZED_MATCH_PREDICTION;

  const isComplete = prediction.predictedWinnerTeamId !== null && prediction.predictedMargin !== null;
  if (!prediction.isFrozen || !isComplete || match.status !== "FINISHED") {
    return ABSENT_MATCH_PREDICTION;
  }

  const actualWinnerTeamId = matchWinnerTeamId(match);
  if (!actualWinnerTeamId) return NEUTRALIZED_MATCH_PREDICTION; // anomalie déjà journalisée

  const actualMargin = Math.abs((match.homeScore as number) - (match.awayScore as number));
  const isWinnerCorrect = prediction.predictedWinnerTeamId === actualWinnerTeamId;

  if (!isWinnerCorrect) {
    return { isWinnerCorrect: false, marginDiff: null, winnerPoints: 0, marginBonusPoints: 0 };
  }

  const marginDiff = Math.abs((prediction.predictedMargin as number) - actualMargin);
  return {
    isWinnerCorrect: true,
    marginDiff,
    winnerPoints: 10,
    marginBonusPoints: marginBonusFor(marginDiff),
  };
}

// ── §6/§7 — Barème BRACKET (Playoffs + NBA Cup) ──────────────────────────

const PLAYOFF_WINNER_POINTS: Record<string, number> = {
  ROUND_1: 25,
  CONF_SEMIS: 45,
  CONF_FINALS: 80,
  NBA_FINALS: 250,
};
const PLAYOFF_EXACT_SCORE_POINTS: Record<string, number> = {
  ROUND_1: 10,
  CONF_SEMIS: 20,
  CONF_FINALS: 30,
  NBA_FINALS: 50,
};
const PLAYOFF_MATCHUP_POINTS: Record<string, number> = {
  ROUND_1: 0,
  CONF_SEMIS: 15,
  CONF_FINALS: 25,
  NBA_FINALS: 40,
};
const CUP_WINNER_POINTS: Record<string, number> = { CUP_QUARTERS: 20, CUP_SEMIS: 50, CUP_FINAL: 150 };
const CUP_MATCHUP_POINTS: Record<string, number> = { CUP_QUARTERS: 0, CUP_SEMIS: 15, CUP_FINAL: 25 };

// Tours sans affiche à deviner (matchups déjà connus à l'ouverture) — §6.2/§7.2.
const NO_MATCHUP_ROUNDS = new Set(["ROUND_1", "CUP_QUARTERS"]);

function unorderedPairEquals(
  a: { a: string | null; b: string | null },
  b: { a: string; b: string }
): boolean {
  if (a.a === null || a.b === null) return false;
  return (a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a);
}

export function scoreBracketPick(
  pick: { predictedWinnerTeamId: string | null; predictedScoreFormat: SeriesFormatValue | null },
  round: PlayoffRoundValue,
  outcome: SeriesOutcome,
  predictedPair: { a: string | null; b: string | null },
  officialPair: { a: string | null; b: string | null }
): BracketPickScore {
  const isCup = round.startsWith("CUP_");
  const winnerTable = isCup ? CUP_WINNER_POINTS : PLAYOFF_WINNER_POINTS;
  const matchupTable = isCup ? CUP_MATCHUP_POINTS : PLAYOFF_MATCHUP_POINTS;

  // Neutralisation A2 (§9.1) : unconditionnelle sur toute la ligne.
  if (outcome.status === "CANCELLED") {
    return {
      isWinnerCorrect: null,
      isScoreExact: null,
      isMatchupCorrect: null,
      winnerPoints: 0,
      exactScorePoints: isCup ? null : 0,
      matchupPoints: 0,
    };
  }

  // VAINQUEUR + SCORE EXACT : gagnés seulement si la série est FINISHED
  // avec un vainqueur officiel connu (§6.2/§6.4) — sinon EN ATTENTE (NULL).
  let isWinnerCorrect: boolean | null = null;
  let winnerPoints: number | null = null;
  let isScoreExact: boolean | null = null;
  let exactScorePoints: number | null = null;

  if (outcome.status === "FINISHED" && outcome.winnerTeamId !== null) {
    isWinnerCorrect = pick.predictedWinnerTeamId === outcome.winnerTeamId;
    winnerPoints = isWinnerCorrect ? winnerTable[round] : 0;

    if (isCup) {
      isScoreExact = null;
      exactScorePoints = null;
    } else {
      isScoreExact = isWinnerCorrect && pick.predictedScoreFormat === outcome.scoreFormat;
      exactScorePoints = isScoreExact ? PLAYOFF_EXACT_SCORE_POINTS[round] : 0;
    }
  }

  // AFFICHE : condition INDÉPENDANTE de outcome.status — se score dès que la
  // paire OFFICIELLE de la série est connue, même si la série elle-même
  // n'a pas encore été jouée (§6.3 : "sera scorée quand la paire officielle
  // sera connue", pas "quand la série sera terminée").
  let isMatchupCorrect: boolean | null = null;
  let matchupPoints: number | null = null;

  if (NO_MATCHUP_ROUNDS.has(round)) {
    isMatchupCorrect = false;
    matchupPoints = 0;
  } else if (officialPair.a === null || officialPair.b === null) {
    // Paire officielle pas encore connue → en attente, jamais un faux 0.
    isMatchupCorrect = null;
    matchupPoints = null;
  } else if (predictedPair.a === null || predictedPair.b === null) {
    // Paire officielle connue mais le joueur n'a pas routé de paire complète.
    isMatchupCorrect = false;
    matchupPoints = 0;
  } else {
    isMatchupCorrect = unorderedPairEquals(predictedPair, {
      a: officialPair.a,
      b: officialPair.b,
    });
    matchupPoints = isMatchupCorrect ? matchupTable[round] : 0;
  }

  return { isWinnerCorrect, isScoreExact, isMatchupCorrect, winnerPoints, exactScorePoints, matchupPoints };
}

// ── §8 — Barème PARIS personnalisés ──────────────────────────────────────

const BET_DIFFICULTY_POINTS: Record<number, number> = { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25 };

export function scoreBet(bet: { status: BetStatusValue; validatedDifficulty: number | null }): BetScore {
  switch (bet.status) {
    case "WON": {
      if (bet.validatedDifficulty === null) {
        // Anomalie journalisée (§8) : "validé fait foi" — jamais un repli
        // silencieux sur proposed_difficulty, contrat T6 §12.4.
        console.error("scoring: pari WON sans validated_difficulty — anomalie, non scoré");
        return { pointsAwarded: null };
      }
      return { pointsAwarded: BET_DIFFICULTY_POINTS[bet.validatedDifficulty] ?? null };
    }
    case "LOST":
    case "CANCELLED":
      return { pointsAwarded: 0 };
    default:
      // DRAFT | SUBMITTED | VALIDATED | REJECTED → non résolu, hors jeu.
      return { pointsAwarded: null };
  }
}
