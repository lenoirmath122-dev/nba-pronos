import { describe, expect, it } from "vitest";
import { unpublishedDailySeriesIds } from "./dailyVisibility";

describe("unpublishedDailySeriesIds", () => {
  const rows = [
    { id: "a", slot_index: 20261024 },
    { id: "b", slot_index: 20261026 },
    { id: "c", slot_index: 20261027 },
  ];

  it("un jour est masqué avant 10h Paris le D-6, visible ensuite", () => {
    // 26/10 : publié le 20/10 (CEST), 10h Paris = 08:00Z. Le 24/10, comme les
    // jours 20 à 25/10, est publié ensemble le 19/10 (lancement).
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-10-19T07:59:59Z"))).toEqual(["a", "b", "c"]);
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-10-19T08:00:00Z"))).toEqual(["b", "c"]);
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-10-20T08:00:00Z"))).toEqual(["c"]);
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-10-21T08:00:00Z"))).toEqual([]);
  });

  it("tout est publié après le dernier jour", () => {
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-11-01T00:00:00Z"))).toEqual([]);
  });

  it("aucune série DAILY (Playoffs/Cup) -> rien de masqué", () => {
    expect(unpublishedDailySeriesIds([], Date.now())).toEqual([]);
  });
});
