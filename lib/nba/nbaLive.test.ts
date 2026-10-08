import { describe, it, expect } from "vitest";
import { nbaLivePayloadSchema, normalizeNbaGame, orientToApp, type NbaLiveGame } from "./nbaLive";

// Fixtures construites à la main d'après la forme du scoreboard cdn.nba.com
// (todaysScoreboard_00.json). À remplacer/compléter par des captures réelles
// dès que la VM peut les récupérer (voir plan PR B).
const periods = (scores: number[]) => scores.map((score, i) => ({ period: i + 1, periodType: i < 4 ? "REGULAR" : "OVERTIME", score }));

const game = (over: Partial<NbaLiveGame> & { home?: number[]; away?: number[]; homeScore?: number; awayScore?: number }): NbaLiveGame => ({
  gameId: "0012600001",
  gameStatus: 3,
  gameStatusText: "Final",
  period: 4,
  gameTimeUTC: "2026-10-08T00:00:00Z",
  homeTeam: { teamTricode: "LAL", score: over.homeScore ?? 100, periods: periods(over.home ?? [25, 25, 25, 25]) },
  awayTeam: { teamTricode: "GSW", score: over.awayScore ?? 80, periods: periods(over.away ?? [20, 20, 20, 20]) },
  ...over,
});

describe("normalizeNbaGame", () => {
  it("FINISHED : scores, quarts et pas de prolongation", () => {
    const n = normalizeNbaGame(game({}));
    expect(n.ok && n.game.result).toEqual({
      status: "FINISHED",
      home_score: 100,
      away_score: 80,
      went_to_ot: false,
      quarter_scores: { homeTeam: [25, 25, 25, 25], awayTeam: [20, 20, 20, 20] },
    });
  });

  it("Final/OT : went_to_ot vrai avec 5 périodes", () => {
    const n = normalizeNbaGame(
      game({ gameStatusText: "Final/OT", period: 5, home: [20, 20, 20, 20, 10], away: [20, 20, 20, 20, 8], homeScore: 90, awayScore: 88 })
    );
    expect(n.ok && n.game.result.went_to_ot).toBe(true);
    expect(n.ok && n.game.result.quarter_scores?.homeTeam).toHaveLength(5);
  });

  it("IN_PROGRESS : tronque les quarts futurs pré-remplis à 0", () => {
    const n = normalizeNbaGame(
      game({ gameStatus: 2, gameStatusText: "Half", period: 2, home: [25, 20, 0, 0], away: [22, 18, 0, 0], homeScore: 45, awayScore: 40 })
    );
    expect(n.ok && n.game.result).toMatchObject({
      status: "IN_PROGRESS",
      home_score: 45,
      away_score: 40,
      went_to_ot: false,
      quarter_scores: { homeTeam: [25, 20], awayTeam: [22, 18] },
    });
  });

  it("SCHEDULED : aucun score (null, pas 0)", () => {
    const n = normalizeNbaGame(game({ gameStatus: 1, gameStatusText: "7:30 pm ET", period: 0, home: [], away: [], homeScore: 0, awayScore: 0 }));
    expect(n.ok && n.game.result).toEqual({ status: "SCHEDULED", home_score: null, away_score: null, went_to_ot: null, quarter_scores: null });
  });

  it("PPD -> POSTPONED, Canceled -> CANCELLED", () => {
    const ppd = normalizeNbaGame(game({ gameStatus: 1, gameStatusText: "PPD", home: [], away: [] }));
    const can = normalizeNbaGame(game({ gameStatus: 1, gameStatusText: "Canceled", home: [], away: [] }));
    expect(ppd.ok && ppd.game.result.status).toBe("POSTPONED");
    expect(can.ok && can.game.result.status).toBe("CANCELLED");
  });

  it("FINISHED avec somme des périodes != score officiel : ignoré", () => {
    const n = normalizeNbaGame(game({ homeScore: 101 }));
    expect(n).toEqual({ ok: false, gameId: "0012600001", reason: "incohérence score/périodes" });
  });

  it("FINISHED sans périodes : ignoré", () => {
    const n = normalizeNbaGame(game({ home: [], away: [] }));
    expect(n.ok).toBe(false);
  });
});

describe("orientToApp", () => {
  const n = normalizeNbaGame(game({}));
  if (!n.ok) throw new Error("fixture");

  it("même sens : résultat inchangé", () => {
    expect(orientToApp(n.game, "LAL").home_score).toBe(100);
  });

  it("sens inverse (site neutre) : scores et quarts échangés", () => {
    const r = orientToApp(n.game, "GSW");
    expect(r.home_score).toBe(80);
    expect(r.away_score).toBe(100);
    expect(r.quarter_scores).toEqual({ homeTeam: [20, 20, 20, 20], awayTeam: [25, 25, 25, 25] });
  });
});

describe("nbaLivePayloadSchema", () => {
  const ok = { source: "NBA_CDN_SCOREBOARD", games: [game({})] };
  it("accepte un corps valide", () => {
    expect(nbaLivePayloadSchema.safeParse(ok).success).toBe(true);
  });
  it("rejette un gameStatus inattendu", () => {
    expect(nbaLivePayloadSchema.safeParse({ ...ok, games: [{ ...game({}), gameStatus: 4 }] }).success).toBe(false);
  });
  it("rejette une source inconnue", () => {
    expect(nbaLivePayloadSchema.safeParse({ ...ok, source: "AUTRE" }).success).toBe(false);
  });
  it("rejette un tricode invalide", () => {
    const g = game({});
    g.homeTeam.teamTricode = "lal";
    expect(nbaLivePayloadSchema.safeParse({ ...ok, games: [g] }).success).toBe(false);
  });
});
