// Tests du moteur pur — SPEC_TECHNIQUE_SCORING_V0_1 §11 (cas 1-27, cas de
// table, sans base). Le cas 5 (respect d'un CANCELLED déjà posé) est un
// garde-fou d'ORCHESTRATION (voir engine.ts, commentaire de
// deriveSeriesOutcome) — testé avec recomputeSeries, pas ici. Les cas 28-32
// (idempotence/orchestration) vivent dans lib/scoring/recompute.test.ts
// (lot suivant).

import { describe, it, expect, vi } from "vitest";
import {
  deriveSeriesOutcome,
  scoreMatchPrediction,
  scoreBracketPick,
  scoreBet,
  type OfficialMatch,
} from "./engine";

function match(overrides: Partial<OfficialMatch> & { id: string }): OfficialMatch {
  return {
    status: "FINISHED",
    homeTeamId: "TEAM_A",
    awayTeamId: "TEAM_B",
    homeScore: 100,
    awayScore: 90,
    ...overrides,
  };
}

describe("deriveSeriesOutcome (§4)", () => {
  it("cas 1 — 4 matchs FINISHED 4-0 → FINISHED, format 4-0", () => {
    const matches = [1, 2, 3, 4].map((n) =>
      match({ id: `m${n}`, homeTeamId: "A", awayTeamId: "B", homeScore: 100, awayScore: 90 })
    );
    const outcome = deriveSeriesOutcome(matches, "PLAYOFFS");
    expect(outcome).toEqual({ status: "FINISHED", winnerTeamId: "A", scoreFormat: "4-0" });
  });

  it("cas 2 — série 3-3 puis match 7 → clinch 4-3", () => {
    const matches = [
      ...[1, 2, 3].map((n) => match({ id: `wA${n}`, homeTeamId: "A", awayTeamId: "B", homeScore: 100, awayScore: 90 })),
      ...[4, 5, 6].map((n) => match({ id: `wB${n}`, homeTeamId: "A", awayTeamId: "B", homeScore: 80, awayScore: 90 })),
      match({ id: "m7", homeTeamId: "A", awayTeamId: "B", homeScore: 100, awayScore: 95 }),
    ];
    const outcome = deriveSeriesOutcome(matches, "PLAYOFFS");
    expect(outcome).toEqual({ status: "FINISHED", winnerTeamId: "A", scoreFormat: "4-3" });
  });

  it("cas 3 — série 3-2 (5 joués) → IN_PROGRESS, winner/format NULL", () => {
    const matches = [
      ...[1, 2, 3].map((n) => match({ id: `wA${n}`, homeTeamId: "A", awayTeamId: "B", homeScore: 100, awayScore: 90 })),
      ...[4, 5].map((n) => match({ id: `wB${n}`, homeTeamId: "A", awayTeamId: "B", homeScore: 80, awayScore: 90 })),
    ];
    const outcome = deriveSeriesOutcome(matches, "PLAYOFFS");
    expect(outcome).toEqual({ status: "IN_PROGRESS", winnerTeamId: null, scoreFormat: null });
  });

  it("cas 4 — Cup (1 match FINISHED) → FINISHED, format NULL", () => {
    const outcome = deriveSeriesOutcome(
      [match({ id: "m1", homeTeamId: "A", awayTeamId: "B", homeScore: 110, awayScore: 105 })],
      "NBA_CUP"
    );
    expect(outcome).toEqual({ status: "FINISHED", winnerTeamId: "A", scoreFormat: null });
  });
});

describe("scoreMatchPrediction (§5)", () => {
  const finishedMatch = match({ id: "m1", homeTeamId: "A", awayTeamId: "B", homeScore: 100, awayScore: 90 }); // actualMargin=10, winner=A

  it("cas 6 — bon vainqueur, écart exact → 10+5=15", () => {
    const score = scoreMatchPrediction({ predictedWinnerTeamId: "A", predictedMargin: 10, isFrozen: true }, finishedMatch);
    expect(score).toEqual({ isWinnerCorrect: true, marginDiff: 0, winnerPoints: 10, marginBonusPoints: 5 });
  });

  it("cas 7 — bon vainqueur, marginDiff 4 → 10+2=12", () => {
    const score = scoreMatchPrediction({ predictedWinnerTeamId: "A", predictedMargin: 14, isFrozen: true }, finishedMatch);
    expect(score.marginDiff).toBe(4);
    expect(score.winnerPoints).toBe(10);
    expect(score.marginBonusPoints).toBe(2);
  });

  it("cas 8 — bon vainqueur, marginDiff 12 → 10+0=10", () => {
    const score = scoreMatchPrediction({ predictedWinnerTeamId: "A", predictedMargin: 22, isFrozen: true }, finishedMatch);
    expect(score.marginDiff).toBe(12);
    expect(score.winnerPoints).toBe(10);
    expect(score.marginBonusPoints).toBe(0);
  });

  it("cas 9 — mauvais vainqueur → 0, marginDiff NULL", () => {
    const score = scoreMatchPrediction({ predictedWinnerTeamId: "B", predictedMargin: 10, isFrozen: true }, finishedMatch);
    expect(score).toEqual({ isWinnerCorrect: false, marginDiff: null, winnerPoints: 0, marginBonusPoints: 0 });
  });

  it("cas 10 — match CANCELLED → neutralisé 0/0, flags NULL, même sans prédiction", () => {
    const cancelled = match({ id: "m2", status: "CANCELLED", homeScore: null, awayScore: null });
    const score = scoreMatchPrediction({ predictedWinnerTeamId: null, predictedMargin: null, isFrozen: false }, cancelled);
    expect(score).toEqual({ isWinnerCorrect: null, marginDiff: null, winnerPoints: 0, marginBonusPoints: 0 });
  });

  it("cas 11 — prédiction non figée ou partielle → absence, tout NULL", () => {
    expect(scoreMatchPrediction({ predictedWinnerTeamId: "A", predictedMargin: 10, isFrozen: false }, finishedMatch)).toEqual(
      { isWinnerCorrect: null, marginDiff: null, winnerPoints: null, marginBonusPoints: null }
    );
    expect(scoreMatchPrediction({ predictedWinnerTeamId: "A", predictedMargin: null, isFrozen: true }, finishedMatch)).toEqual(
      { isWinnerCorrect: null, marginDiff: null, winnerPoints: null, marginBonusPoints: null }
    );
  });
});

describe("scoreBracketPick — Playoffs (§6)", () => {
  const finishedOutcome = { status: "FINISHED" as const, winnerTeamId: "A", scoreFormat: "4-2" as const };

  it("cas 12 — CONF_FINALS vainqueur+format+affiche OK → 80+30+25=135", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "CONF_FINALS",
      finishedOutcome,
      { a: "A", b: "C" },
      { a: "C", b: "A" } // non ordonné, doit matcher
    );
    expect(score.winnerPoints).toBe(80);
    expect(score.exactScorePoints).toBe(30);
    expect(score.matchupPoints).toBe(25);
  });

  it("cas 13 — NBA_FINALS parfaite → 250+50+40=340", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "NBA_FINALS",
      finishedOutcome,
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(score.winnerPoints).toBe(250);
    expect(score.exactScorePoints).toBe(50);
    expect(score.matchupPoints).toBe(40);
  });

  it("cas 14 — vainqueur OK, format faux → score exact = 0", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-0" },
      "CONF_FINALS",
      finishedOutcome,
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(score.isWinnerCorrect).toBe(true);
    expect(score.winnerPoints).toBe(80);
    expect(score.isScoreExact).toBe(false);
    expect(score.exactScorePoints).toBe(0);
  });

  it("cas 15 — affiche OK, vainqueur faux → affiche seule (orthogonalité)", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "C", predictedScoreFormat: "4-2" },
      "CONF_FINALS",
      finishedOutcome,
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(score.isWinnerCorrect).toBe(false);
    expect(score.winnerPoints).toBe(0);
    expect(score.isScoreExact).toBe(false);
    expect(score.exactScorePoints).toBe(0);
    expect(score.isMatchupCorrect).toBe(true);
    expect(score.matchupPoints).toBe(25);
  });

  it("cas 16 — ROUND_1 → affiche = 0 (matchups déjà connus)", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "ROUND_1",
      finishedOutcome,
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(score.isMatchupCorrect).toBe(false);
    expect(score.matchupPoints).toBe(0);
  });

  it("cas 17 — paire prédite incomplète (feeder sans pick) → affiche = 0", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "CONF_FINALS",
      finishedOutcome,
      { a: "A", b: null },
      { a: "A", b: "C" }
    );
    expect(score.isMatchupCorrect).toBe(false);
    expect(score.matchupPoints).toBe(0);
  });

  it("cas 18 — paire officielle incomplète → affiche NULL (en attente, pas 0)", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "CONF_FINALS",
      { status: "SCHEDULED", winnerTeamId: null, scoreFormat: null },
      { a: "A", b: "C" },
      { a: "A", b: null }
    );
    expect(score.isMatchupCorrect).toBeNull();
    expect(score.matchupPoints).toBeNull();
  });

  it("cas 19 — comparaison d'affiche non ordonnée {A,B} vs {B,A} → correct (A3)", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "CONF_FINALS",
      finishedOutcome,
      { a: "C", b: "A" },
      { a: "A", b: "C" }
    );
    expect(score.isMatchupCorrect).toBe(true);
  });
});

describe("scoreBracketPick — NBA Cup (§7)", () => {
  it("cas 20 — CUP_SEMIS vainqueur+affiche OK → 50+15=65, exact NULL", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: null },
      "CUP_SEMIS",
      { status: "FINISHED", winnerTeamId: "A", scoreFormat: null },
      { a: "A", b: "C" },
      { a: "C", b: "A" }
    );
    expect(score.winnerPoints).toBe(50);
    expect(score.matchupPoints).toBe(15);
    expect(score.isScoreExact).toBeNull();
    expect(score.exactScorePoints).toBeNull();
  });

  it("cas 21 — CUP_FINAL vainqueur OK → 150 ; CUP_QUARTERS affiche = 0", () => {
    const finalScore = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: null },
      "CUP_FINAL",
      { status: "FINISHED", winnerTeamId: "A", scoreFormat: null },
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(finalScore.winnerPoints).toBe(150);

    const quartersScore = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: null },
      "CUP_QUARTERS",
      { status: "FINISHED", winnerTeamId: "A", scoreFormat: null },
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(quartersScore.matchupPoints).toBe(0);
  });
});

describe("scoreBet (§8)", () => {
  it("cas 22 — WON niveau 5 → 25 ; WON niveau 1 → 5", () => {
    expect(scoreBet({ status: "WON", validatedDifficulty: 5 })).toEqual({ pointsAwarded: 25 });
    expect(scoreBet({ status: "WON", validatedDifficulty: 1 })).toEqual({ pointsAwarded: 5 });
  });

  it("cas 23 — LOST/CANCELLED → 0 ; les autres statuts → NULL", () => {
    expect(scoreBet({ status: "LOST", validatedDifficulty: null })).toEqual({ pointsAwarded: 0 });
    expect(scoreBet({ status: "CANCELLED", validatedDifficulty: null })).toEqual({ pointsAwarded: 0 });
    for (const status of ["DRAFT", "SUBMITTED", "VALIDATED", "REJECTED"] as const) {
      expect(scoreBet({ status, validatedDifficulty: null })).toEqual({ pointsAwarded: null });
    }
  });

  it("cas 24 — WON sans validated_difficulty → anomalie journalisée, non scoré", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(scoreBet({ status: "WON", validatedDifficulty: null })).toEqual({ pointsAwarded: null });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("A2 — neutralisation et cascade (§9)", () => {
  it("cas 25 — série CANCELLED → tous les picks à 0, flags NULL", () => {
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: "4-2" },
      "CONF_FINALS",
      { status: "CANCELLED", winnerTeamId: null, scoreFormat: null },
      { a: "A", b: "C" },
      { a: "A", b: "C" }
    );
    expect(score).toEqual({
      isWinnerCorrect: null,
      isScoreExact: null,
      isMatchupCorrect: null,
      winnerPoints: 0,
      exactScorePoints: 0,
      matchupPoints: 0,
    });
  });

  it("cas 26 — série amont CANCELLED, aval non résolu → affiche aval EN ATTENTE (pas 0)", () => {
    // La série amont annulée laisse un slot de la paire officielle aval
    // manquant — la série aval elle-même reste SCHEDULED (pas jouée).
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: null },
      "CONF_SEMIS",
      { status: "SCHEDULED", winnerTeamId: null, scoreFormat: null },
      { a: "A", b: "C" },
      { a: "A", b: null } // 2e slot jamais résolu (amont annulée)
    );
    expect(score.matchupPoints).toBeNull();
    expect(score.isMatchupCorrect).toBeNull();
    // Aucun point fantôme : le vainqueur reste NULL aussi (série pas FINISHED).
    expect(score.winnerPoints).toBeNull();
  });

  it("cas 27 — admin résout l'aval (paire renseignée) → affiche scorée normalement, sans code spécial", () => {
    // Même série qu'au cas 26, mais l'admin a maintenant renseigné le 2e
    // slot de la paire officielle — la série reste SCHEDULED (pas encore
    // jouée), mais l'affiche devient scorable (indépendant du vainqueur).
    const score = scoreBracketPick(
      { predictedWinnerTeamId: "A", predictedScoreFormat: null },
      "CONF_SEMIS",
      { status: "SCHEDULED", winnerTeamId: null, scoreFormat: null },
      { a: "A", b: "C" },
      { a: "C", b: "A" } // paire désormais complète, non ordonnée mais identique
    );
    expect(score.isMatchupCorrect).toBe(true);
    expect(score.matchupPoints).toBe(15); // CONF_SEMIS matchup
    expect(score.winnerPoints).toBeNull(); // série toujours pas FINISHED
  });
});
