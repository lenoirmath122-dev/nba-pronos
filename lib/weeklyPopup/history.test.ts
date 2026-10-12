import { describe, expect, it } from "vitest";
import { computeFeaturedUserIds } from "./featured";
import { recentlyFeatured } from "./history";
import { U1, U2, U3, U4 } from "./testFixtures";

describe("computeFeaturedUserIds", () => {
  it("top, flop et refusé seulement, sans doublon ni jeton supprimé", () => {
    const ids = computeFeaturedUserIds({
      top: `{{u:${U1}}} et {{u:${U2}}}`,
      flop: `{{u:${U1}}} {{u:supprime}}`,
      refuse: null,
    });
    expect(ids.sort()).toEqual([U1, U2].sort());
  });
});

describe("recentlyFeatured", () => {
  const rows = [
    { week_end_date: "2026-10-19", status: "PUBLISHED" as const, featured_user_ids: [U1] },
    { week_end_date: "2026-10-12", status: "PUBLISHED" as const, featured_user_ids: [U2] },
    { week_end_date: "2026-10-05", status: "PUBLISHED" as const, featured_user_ids: [U3] },
    { week_end_date: "2026-10-26", status: "RETRACTED" as const, featured_user_ids: [U4] },
    { week_end_date: "2026-11-02", status: "PUBLISHED" as const, featured_user_ids: [U4] },
  ];

  it("les 2 dernières PUBLISHED antérieures à la semaine, sans RETRACTED", () => {
    expect([...recentlyFeatured(rows, "2026-10-26")].sort()).toEqual([U1, U2].sort());
  });
  it("avant la première popup : vide", () => {
    expect(recentlyFeatured([], "2026-10-26").size).toBe(0);
  });
});
