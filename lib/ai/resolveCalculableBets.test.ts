// Tests des fonctions PURES de résolution des paris IA calculables (Cadrage/
// Suivi/BILAN_GLOBAL_01_09_2026.md, chantier fiabilité & QA, 01/09/2026) —
// c'est cette logique qui décide, au final, si un pari entre potes est gagné
// ou perdu, donc l'enjeu le plus élevé de resolveCalculableBets.ts (2500+
// lignes, aucun test avant ce fichier).
//
// Volontairement limité aux fonctions SANS Supabase (exportées pour ce
// fichier uniquement, zéro changement de comportement) — les 14 fonctions
// `resolveCalculable*Bets()` elles-mêmes (orchestration DB) sont testées à
// part, une par une, en commençant par resolveCalculableComboBets (voir
// resolveCalculableComboBets.test.ts).

import { describe, it, expect } from "vitest";
import {
  minutesToFloat,
  categoriesAtTen,
  computeOutcome,
  periodQuarterIndices,
  cumulativeQuarterIndices,
  sumQuarterRange,
  computePeriodTeamOutcome,
  sumBoxRows,
  rawStatValue,
  type BoxScoreRow,
  type MatchPeriodRow,
  type RosterSplitBoxRow,
} from "./resolveCalculableBets";

function box(overrides: Partial<BoxScoreRow> = {}): BoxScoreRow {
  return {
    minutes: "30:00",
    pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0,
    ftm: 0, fta: 0, fgm: 0, fga: 0, fg3a: 0, oreb: 0,
    plus_minus: 0, technical_fouls: 0,
    ...overrides,
  };
}

function periodMatch(overrides: Partial<MatchPeriodRow> = {}): MatchPeriodRow {
  return {
    id: "m1",
    status: "FINISHED",
    home_team_id: "A",
    away_team_id: "B",
    home_score: 105,
    away_score: 95,
    // Q1 25-20, Q2 28-24, Q3 22-26, Q4 30-25 — home gagne 3 quarts sur 4,
    // mène à la mi-temps (53-44), gagne le match (105-95).
    quarter_scores: { homeTeam: [25, 28, 22, 30], awayTeam: [20, 24, 26, 25] },
    ...overrides,
  };
}

// ── minutesToFloat ────────────────────────────────────────────────────────

describe("minutesToFloat", () => {
  it.each([
    [null, 0],
    ["", 0],
    ["12:34", 12 + 34 / 60],
    ["5", 5],
    ["abc", 0], // valeur non numérique et sans ":" → repli 0, jamais NaN.
  ])("minutesToFloat(%o) === %d", (raw, expected) => {
    expect(minutesToFloat(raw)).toBeCloseTo(expected, 5);
  });
});

// ── categoriesAtTen / computeOutcome(dd/td/tech) ─────────────────────────

describe("categoriesAtTen", () => {
  it("compte les catégories >= 10 parmi pts/reb/ast/stl/blk", () => {
    expect(categoriesAtTen(box({ pts: 25, reb: 11, ast: 3, stl: 1, blk: 0 }))).toBe(2);
    expect(categoriesAtTen(box({ pts: 30, reb: 12, ast: 11, stl: 10, blk: 10 }))).toBe(5);
    expect(categoriesAtTen(box({ pts: 9, reb: 9, ast: 9, stl: 0, blk: 0 }))).toBe(0);
  });
});

describe("computeOutcome — dd/td/tech (NO_THRESHOLD_STATS)", () => {
  it("dd = au moins 2 catégories à 10, td = au moins 3", () => {
    const doubleDouble = box({ pts: 25, reb: 11 });
    const tripleDouble = box({ pts: 25, reb: 11, ast: 10 });
    expect(computeOutcome("dd", null, null, doubleDouble)).toBe(true);
    expect(computeOutcome("td", null, null, doubleDouble)).toBe(false);
    expect(computeOutcome("td", null, null, tripleDouble)).toBe(true);
  });

  it("tech = au moins 1 faute technique, jamais dérivé de categoriesAtTen", () => {
    // Bug réel documenté dans resolveCalculableBets.ts (25/08/2026) : un
    // check générique NO_THRESHOLD_STATS aurait fait tomber "tech" dans la
    // branche dd/td (categoriesAtTen >= 3) — non-régression explicite.
    expect(computeOutcome("tech", null, null, box({ technical_fouls: 1 }))).toBe(true);
    expect(computeOutcome("tech", null, null, box({ technical_fouls: 0 }))).toBe(false);
    expect(computeOutcome("tech", null, null, box({ pts: 30, reb: 15, ast: 12, technical_fouls: 0 }))).toBe(false);
  });
});

// ── computeOutcome — stats en pourcentage (ft/fg/fg3) ────────────────────

describe("computeOutcome — stats en pourcentage", () => {
  it("compare le taux réel (makes/attempts) au seuil", () => {
    const b = box({ fgm: 6, fga: 10 }); // 60%
    expect(computeOutcome("fg", 0.5, "OVER", b)).toBe(true);
    expect(computeOutcome("fg", 0.5, "UNDER", b)).toBe(false);
    expect(computeOutcome("fg", 0.7, "OVER", b)).toBe(false);
  });

  it("0 tentative → taux 0 (pas de division par zéro/NaN)", () => {
    const b = box({ fgm: 0, fga: 0 });
    expect(computeOutcome("fg", 0.1, "OVER", b)).toBe(false);
    expect(computeOutcome("fg", 0.1, "UNDER", b)).toBe(true);
  });

  it("seuil ou comparaison manquants → indéterminé (null), jamais une résolution devinée", () => {
    const b = box({ fgm: 6, fga: 10 });
    expect(computeOutcome("fg", null, "OVER", b)).toBeNull();
    expect(computeOutcome("fg", 0.5, null, b)).toBeNull();
  });
});

// ── computeOutcome — stats comptées (pts/min/plus_minus...) ─────────────

describe("computeOutcome — stats comptées à seuil", () => {
  it("compare la valeur brute au seuil (OVER/UNDER)", () => {
    const b = box({ pts: 25 });
    expect(computeOutcome("pts", 20, "OVER", b)).toBe(true);
    expect(computeOutcome("pts", 20, "UNDER", b)).toBe(false);
    expect(computeOutcome("pts", 30, "OVER", b)).toBe(false);
  });

  it("stat 'min' passe par minutesToFloat, pas une lecture directe", () => {
    const b = box({ minutes: "34:30" });
    expect(computeOutcome("min", 30, "OVER", b)).toBe(true);
    expect(computeOutcome("min", 35, "OVER", b)).toBe(false);
  });

  it("plus_minus lit bien box.plus_minus (non-régression du bug du 25/08/2026)", () => {
    // Avant correctif : plus_minus absent de COUNTING_STAT_COLUMN → actual
    // retombait silencieusement à 0 → toujours perdant, quel que soit le
    // vrai +/- du joueur. Un +/- élevé doit gagner un pari OVER bas.
    const b = box({ plus_minus: 18 });
    expect(computeOutcome("plus_minus", 10, "OVER", b)).toBe(true);
    expect(computeOutcome("plus_minus", 10, "UNDER", b)).toBe(false);
  });

  it("seuil ou comparaison manquants → null", () => {
    const b = box({ pts: 25 });
    expect(computeOutcome("pts", null, "OVER", b)).toBeNull();
    expect(computeOutcome("pts", 20, null, b)).toBeNull();
  });
});

// ── rawStatValue / sumBoxRows ────────────────────────────────────────────

describe("rawStatValue", () => {
  it("'min' passe par minutesToFloat, les autres stats lisent la colonne directe", () => {
    expect(rawStatValue("min", box({ minutes: "10:30" }))).toBeCloseTo(10.5, 5);
    expect(rawStatValue("reb", box({ reb: 12 }))).toBe(12);
  });
});

describe("sumBoxRows", () => {
  it("additionne toutes les stats comptées de plusieurs lignes", () => {
    const rows: RosterSplitBoxRow[] = [
      { ...box({ pts: 20, reb: 5 }), position: "F" },
      { ...box({ pts: 15, reb: 8 }), position: "" },
    ];
    const sum = sumBoxRows(rows);
    expect(sum.pts).toBe(35);
    expect(sum.reb).toBe(13);
    expect(sum.minutes).toBeNull(); // pas de notion de "minutes cumulées" pour un groupe.
  });

  it("liste vide → toutes les stats à 0", () => {
    expect(sumBoxRows([]).pts).toBe(0);
  });
});

// ── periodQuarterIndices / cumulativeQuarterIndices ──────────────────────
// Les deux DIVERGENT volontairement pour H2 (segment [2,3] vs cumulé
// [0,1,2,3]) — bug réel trouvé avant même de coder les modèles Python
// (commentaire de cumulativeQuarterIndices) : MARGIN désigne l'écart
// CUMULÉ depuis le début du match, TOTAL_POINTS le total du SEGMENT de
// cette période. Un test qui confondrait les deux masquerait la régression.

describe("periodQuarterIndices (segment de la période)", () => {
  it.each([
    ["Q1", [0]], ["Q2", [1]], ["Q3", [2]], ["Q4", [3]],
    ["H1", [0, 1]], ["H2", [2, 3]],
  ] as const)("%s -> %o", (period, expected) => {
    expect(periodQuarterIndices(period)).toEqual(expected);
  });
});

describe("cumulativeQuarterIndices (depuis le début du match)", () => {
  it.each([
    ["Q1", [0]], ["Q2", [0, 1]], ["Q3", [0, 1, 2]], ["Q4", [0, 1, 2, 3]],
    ["H1", [0, 1]], ["H2", [0, 1, 2, 3]],
  ] as const)("%s -> %o", (period, expected) => {
    expect(cumulativeQuarterIndices(period)).toEqual(expected);
  });

  it("diverge de periodQuarterIndices sur H2 — non-régression du bug de cadrage", () => {
    expect(cumulativeQuarterIndices("H2")).not.toEqual(periodQuarterIndices("H2"));
  });
});

describe("sumQuarterRange", () => {
  it("additionne les scores aux indices donnés, indice hors bornes = 0", () => {
    expect(sumQuarterRange([20, 25, 22, 30], [0, 1])).toBe(45);
    expect(sumQuarterRange([20, 25, 22, 30], [])).toBe(0);
    expect(sumQuarterRange([20, 25], [0, 1, 5])).toBe(45); // scores[5] undefined -> 0.
  });
});

// ── computePeriodTeamOutcome — paris PERIOD équipe ───────────────────────

describe("computePeriodTeamOutcome", () => {
  it("quarter_scores absent → indéterminé (null), quel que soit outcome_kind", () => {
    const m = periodMatch({ quarter_scores: null });
    expect(computePeriodTeamOutcome("QUARTER_WINNER", "Q1", true, null, null, null, m)).toBeNull();
  });

  describe("QUARTERS_WON_COUNT", () => {
    it("compte les quarts-temps gagnés par l'équipe visée (home gagne Q1/Q2/Q4 = 3)", () => {
      const m = periodMatch();
      const result = computePeriodTeamOutcome("QUARTERS_WON_COUNT", null, true, null, 2, "OVER", m);
      expect(result).toEqual({ won: true, detail: "3 quart(s)-temps remporté(s)" });
    });

    it("exact_count=true exige l'égalité stricte, pas juste OVER/UNDER", () => {
      const m = periodMatch();
      expect(computePeriodTeamOutcome("QUARTERS_WON_COUNT", null, true, true, 3, null, m)?.won).toBe(true);
      expect(computePeriodTeamOutcome("QUARTERS_WON_COUNT", null, true, true, 2, null, m)?.won).toBe(false);
    });

    it("équipe ou seuil manquant → null", () => {
      const m = periodMatch();
      expect(computePeriodTeamOutcome("QUARTERS_WON_COUNT", null, null, null, 2, "OVER", m)).toBeNull();
      expect(computePeriodTeamOutcome("QUARTERS_WON_COUNT", null, true, null, null, "OVER", m)).toBeNull();
    });
  });

  describe("LEADS_HALF_RESULT", () => {
    it("mène à la mi-temps ET gagne le match (comparison=OVER)", () => {
      const m = periodMatch(); // home mène 53-44, gagne 105-95.
      const result = computePeriodTeamOutcome("LEADS_HALF_RESULT", null, true, null, null, "OVER", m);
      expect(result?.won).toBe(true);
    });

    it("comparison=UNDER = mène à la mi-temps PUIS perd le match", () => {
      const m = periodMatch(); // home mène ET gagne -> UNDER doit être faux.
      const result = computePeriodTeamOutcome("LEADS_HALF_RESULT", null, true, null, null, "UNDER", m);
      expect(result?.won).toBe(false);
    });

    it("ne mène même pas à la mi-temps → faux d'emblée, peu importe le résultat final", () => {
      const m = periodMatch(); // away ne mène pas à la mi-temps (44 < 53).
      const result = computePeriodTeamOutcome("LEADS_HALF_RESULT", null, false, null, null, "OVER", m);
      expect(result?.won).toBe(false);
      expect(result?.detail).toContain("ne mène pas");
    });
  });

  describe("MARGIN — écart cumulé depuis le début du match", () => {
    it("period=Q3 → cumule Q1+Q2+Q3 (indices [0,1,2]), pas seulement Q3", () => {
      const m = periodMatch();
      // home Q1-Q3 = 25+28+22=75, away = 20+24+26=70, écart = 5.
      expect(computePeriodTeamOutcome("MARGIN", "Q3", null, null, 3, "OVER", m)).toEqual({
        won: true, detail: "5 (écart cumulé)",
      });
      expect(computePeriodTeamOutcome("MARGIN", "Q3", null, null, 10, "UNDER", m)?.won).toBe(true);
    });
  });

  describe("TOTAL_POINTS — total du seul segment de la période", () => {
    it("period=Q4 → seulement le 4e quart-temps (30+25=55), pas le match entier", () => {
      const m = periodMatch();
      expect(computePeriodTeamOutcome("TOTAL_POINTS", "Q4", null, null, 50, "OVER", m)).toEqual({
        won: true, detail: "55 (total combiné)",
      });
      expect(computePeriodTeamOutcome("TOTAL_POINTS", "Q4", null, null, 60, "OVER", m)?.won).toBe(false);
    });
  });

  describe("QUARTER_WINNER / HALF_WINNER", () => {
    it("compare le score de la période entre les 2 équipes, sans seuil", () => {
      const m = periodMatch(); // Q1 home 25 > away 20.
      expect(computePeriodTeamOutcome("QUARTER_WINNER", "Q1", true, null, null, null, m)).toEqual({
        won: true, detail: "25-20 sur cette période",
      });
      expect(computePeriodTeamOutcome("QUARTER_WINNER", "Q1", false, null, null, null, m)?.won).toBe(false);
    });

    it("équipe manquante (symétrique par erreur) → null", () => {
      const m = periodMatch();
      expect(computePeriodTeamOutcome("QUARTER_WINNER", "Q1", null, null, null, null, m)).toBeNull();
    });
  });

  describe("POINT_SHARE_PCT", () => {
    it("part des points de l'équipe marqués pendant cette période", () => {
      const m = periodMatch(); // home Q1=25, home_score=105 -> ~23.8%.
      expect(computePeriodTeamOutcome("POINT_SHARE_PCT", "Q1", true, null, 0.2, "OVER", m)?.won).toBe(true);
      expect(computePeriodTeamOutcome("POINT_SHARE_PCT", "Q1", true, null, 0.3, "OVER", m)?.won).toBe(false);
    });

    it("total de match à 0 → indéterminé (pas de division par zéro)", () => {
      const m = periodMatch({ home_score: 0 });
      expect(computePeriodTeamOutcome("POINT_SHARE_PCT", "Q1", true, null, 0.2, "OVER", m)).toBeNull();
    });
  });
});
