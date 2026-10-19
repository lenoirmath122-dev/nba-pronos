import { describe, it, expect } from "vitest";
import { registrationError, buildPredictionRows, type MatchForBasket } from "./register";
import type { BasketItem } from "./basket";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const ok = { pseudo: "Lebron", email: "a@b.fr", ageConfirmed: true };

describe("registrationError", () => {
  it("accepte une saisie valide", () => {
    expect(registrationError(ok)).toBeNull();
  });

  it("refuse un e-mail, un pseudo ou une case d'âge invalides", () => {
    expect(registrationError({ ...ok, email: "abc" })).toMatch(/e-mail/);
    expect(registrationError({ ...ok, pseudo: "ab" })).toMatch(/pseudo/i);
    expect(registrationError({ ...ok, ageConfirmed: false })).toMatch(/15 ans/);
  });
});

const match = (id: string, over: Partial<MatchForBasket> = {}): MatchForBasket => ({
  id,
  competition_id: "comp",
  scheduled_at: "2026-10-21T00:00:00Z",
  status: "SCHEDULED",
  home_team_id: "h",
  away_team_id: "a",
  ...over,
});
const item = (matchId: string, over: Partial<BasketItem> = {}): BasketItem => ({
  matchId,
  competitionId: "forged",
  winnerTeamId: "h",
  margin: 7,
  addedAt: 1,
  ...over,
});

describe("buildPredictionRows", () => {
  it("construit des pronos validés avec le competition_id de la base", () => {
    const rows = buildPredictionRows("u", [item("m1")], [match("m1")], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: "u", competition_id: "comp", status: "VALIDATED", predicted_margin: 7 });
  });

  it("écarte match commencé, non programmé, inconnu, mauvaise équipe, écart invalide et doublon", () => {
    const rows = buildPredictionRows(
      "u",
      [
        item("started"),
        item("postponed"),
        item("unknown"),
        item("wrongteam", { winnerTeamId: "x" }),
        item("badmargin", { margin: 60 }),
        item("dup"),
        item("dup", { winnerTeamId: "a" }),
      ],
      [
        match("started", { scheduled_at: "2026-10-20T11:00:00Z" }),
        match("postponed", { status: "POSTPONED" }),
        match("wrongteam"),
        match("badmargin"),
        match("dup"),
      ],
      NOW,
    );
    expect(rows.map((r) => r.match_id)).toEqual(["dup"]);
    expect(rows[0].predicted_winner_team_id).toBe("h");
  });
});
