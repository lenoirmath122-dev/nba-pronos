import { describe, expect, it } from "vitest";
import { formLabel, isEarlySeason, isUsualStarter, playerTrend, selectKeyPlayers } from "./labels";
import type { PlayerSeasonLine } from "./types";

describe("formLabel", () => {
  it("DEBUT sous 3 matchs", () => {
    expect(formLabel(2, 2)).toBe("DEBUT");
    expect(formLabel(3, 3)).toBe("EN_FEU");
  });
  it("seuils sur 5 matchs", () => {
    expect(formLabel(10, 5)).toBe("EN_FEU");
    expect(formLabel(10, 4)).toBe("EN_FEU");
    expect(formLabel(10, 3)).toBe("EN_FORME");
    expect(formLabel(10, 2)).toBe("IRREGULIERE");
    expect(formLabel(10, 1)).toBe("EN_DIFFICULTE");
    expect(formLabel(10, 0)).toBe("EN_DIFFICULTE");
  });
  it("fenêtre réduite avec peu de matchs (n = games_played)", () => {
    expect(formLabel(4, 3)).toBe("EN_FORME"); // 0,75
    expect(formLabel(3, 2)).toBe("EN_FORME"); // 0,67
    expect(formLabel(3, 1)).toBe("EN_DIFFICULTE"); // 0,33
  });
});

describe("isEarlySeason", () => {
  it("vrai sous 10 matchs", () => {
    expect(isEarlySeason(9)).toBe(true);
    expect(isEarlySeason(10)).toBe(false);
  });
});

describe("playerTrend", () => {
  const base = { gamesPlayed: 20, last5Games: 5 };
  it("null sous 8 matchs ou moins de 5 récents", () => {
    expect(playerTrend({ ...base, gamesPlayed: 7, ptsAvg: 10, last5PtsAvg: 20 })).toBeNull();
    expect(playerTrend({ ...base, last5Games: 4, ptsAvg: 10, last5PtsAvg: 20 })).toBeNull();
    expect(playerTrend({ ...base, gamesPlayed: 8, ptsAvg: 10, last5PtsAvg: 20 })).toBe("EN_HAUSSE");
  });
  it("hausse : +3 pts ET ×1,2", () => {
    expect(playerTrend({ ...base, ptsAvg: 10, last5PtsAvg: 13 })).toBe("EN_HAUSSE");
    expect(playerTrend({ ...base, ptsAvg: 10, last5PtsAvg: 12.9 })).toBe("STABLE");
    expect(playerTrend({ ...base, ptsAvg: 30, last5PtsAvg: 33 })).toBe("STABLE"); // +3 mais < ×1,2
  });
  it("baisse : -3 pts ET ×0,8", () => {
    expect(playerTrend({ ...base, ptsAvg: 15, last5PtsAvg: 12 })).toBe("EN_BAISSE");
    expect(playerTrend({ ...base, ptsAvg: 15, last5PtsAvg: 12.1 })).toBe("STABLE");
    expect(playerTrend({ ...base, ptsAvg: 30, last5PtsAvg: 27 })).toBe("STABLE"); // -3 mais > ×0,8
  });
});

describe("isUsualStarter", () => {
  it("à partir de la moitié des matchs", () => {
    expect(isUsualStarter(5, 10)).toBe(true);
    expect(isUsualStarter(4, 10)).toBe(false);
    expect(isUsualStarter(0, 0)).toBe(false);
  });
});

function line(over: Partial<PlayerSeasonLine>): PlayerSeasonLine {
  return {
    playerId: 1,
    name: "X",
    gamesPlayed: 10,
    gamesWithTeam: 10,
    isUsualStarter: true,
    minutes: 30,
    pts: 10,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    fg3m: 0,
    fgPct: null,
    fg3Pct: null,
    ftPct: null,
    tsPct: null,
    trend: null,
    joinedMidSeason: false,
    ...over,
  };
}

describe("selectKeyPlayers", () => {
  it("filtre sur la moitié des matchs de l'équipe, tri pts puis minutes, 3 max", () => {
    const roster = [
      line({ playerId: 1, pts: 20, gamesWithTeam: 2 }), // arrivé tard : exclu (min 5)
      line({ playerId: 2, pts: 18, minutes: 30 }),
      line({ playerId: 3, pts: 18, minutes: 35 }),
      line({ playerId: 4, pts: 12 }),
      line({ playerId: 5, pts: 9 }),
    ];
    expect(selectKeyPlayers(roster, 9).map((p) => p.playerId)).toEqual([3, 2, 4]);
  });
  it("au moins 1 match exigé", () => {
    expect(selectKeyPlayers([line({ gamesWithTeam: 0 })], 0)).toEqual([]);
  });
});
