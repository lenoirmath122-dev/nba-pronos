import { describe, it, expect } from "vitest";
import { parseBasket, pruneBasket, upsertItem, removeItem, isValidMargin, type BasketItem, type OpenMatch } from "./basket";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const item = (matchId: string, winnerTeamId = "h", margin = 7): BasketItem => ({
  matchId,
  competitionId: "c",
  winnerTeamId,
  margin,
  addedAt: 1,
});
const open = (id: string, at = "2026-10-21T00:00:00Z"): OpenMatch => ({ id, scheduledAt: at, homeTeamId: "h", awayTeamId: "a" });

describe("parseBasket", () => {
  it("renvoie un panier vide pour null, du JSON invalide ou un autre type", () => {
    expect(parseBasket(null)).toEqual([]);
    expect(parseBasket("{")).toEqual([]);
    expect(parseBasket('{"a":1}')).toEqual([]);
  });

  it("écarte les items invalides et les doublons de match", () => {
    const raw = JSON.stringify([item("m1"), { ...item("m2"), margin: 51 }, { matchId: "m3" }, item("m1", "a", 3)]);
    expect(parseBasket(raw).map((i) => i.matchId)).toEqual(["m1"]);
  });
});

describe("pruneBasket", () => {
  it("garde les matchs ouverts et retire commencés, inconnus ou équipe incohérente", () => {
    const r = pruneBasket(
      [item("ok"), item("started"), item("gone"), item("badteam", "zzz")],
      [open("ok"), open("started", "2026-10-20T11:00:00Z"), open("badteam")],
      NOW,
    );
    expect(r.kept.map((i) => i.matchId)).toEqual(["ok"]);
    expect(r.removed.map((i) => i.matchId)).toEqual(["started", "gone", "badteam"]);
  });
});

describe("upsertItem / removeItem", () => {
  it("remplace le prono du même match", () => {
    const r = upsertItem([item("m1", "h", 3), item("m2")], item("m1", "a", 9));
    expect(r.find((i) => i.matchId === "m1")).toMatchObject({ winnerTeamId: "a", margin: 9 });
    expect(r).toHaveLength(2);
  });

  it("retire un match", () => {
    expect(removeItem([item("m1"), item("m2")], "m1").map((i) => i.matchId)).toEqual(["m2"]);
  });
});

describe("isValidMargin", () => {
  it("accepte 1 à 50 entiers", () => {
    expect([0, 1, 50, 51, 2.5, NaN].map(isValidMargin)).toEqual([false, true, true, false, false, false]);
  });
});
