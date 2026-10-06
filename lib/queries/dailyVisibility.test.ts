import { describe, expect, it } from "vitest";
import { unpublishedDailySeriesIds } from "./dailyVisibility";

describe("unpublishedDailySeriesIds", () => {
  const rows = [
    { id: "a", slot_index: 20261023 },
    { id: "b", slot_index: 20261024 },
    { id: "c", slot_index: 20261025 },
  ];

  it("le jour J est masqué avant 10h Paris, visible ensuite", () => {
    // 24/10 : CEST, 10h Paris = 08:00Z.
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-10-24T07:59:59Z"))).toEqual(["b", "c"]);
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-10-24T08:00:00Z"))).toEqual(["c"]);
  });

  it("tout est publié après le dernier jour", () => {
    expect(unpublishedDailySeriesIds(rows, Date.parse("2026-11-01T00:00:00Z"))).toEqual([]);
  });

  it("aucune série DAILY (Playoffs/Cup) -> rien de masqué", () => {
    expect(unpublishedDailySeriesIds([], Date.now())).toEqual([]);
  });
});
