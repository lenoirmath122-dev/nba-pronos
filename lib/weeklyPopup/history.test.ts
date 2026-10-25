import { describe, expect, it } from "vitest";
import { computeFeaturedUserIds } from "./featured";
import { PHRASING_DEPTH, PHRASING_MAX_CHARS, recentlyFeatured, recentPhrasing } from "./history";
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

describe("recentPhrasing", () => {
  const content = (titre: string, cta: string) => ({ titre, cta });
  const rows = [
    { week_end_date: "2026-10-19", status: "PUBLISHED" as const, content: content(`{{u:${U1}}} règne`, "Fais mieux que {{u:supprime}}.") },
    { week_end_date: "2026-10-12", status: "PUBLISHED" as const, content: content("Titre 12", "Cta 12") },
    { week_end_date: "2026-10-05", status: "PUBLISHED" as const, content: content("Titre 05", "  ") },
    { week_end_date: "2026-09-28", status: "PUBLISHED" as const, content: content("Titre 28", "Cta 28") },
    { week_end_date: "2026-09-21", status: "PUBLISHED" as const, content: content("Trop vieux", "Trop vieux") },
    { week_end_date: "2026-10-26", status: "RETRACTED" as const, content: content("Retirée", "Retirée") },
    { week_end_date: "2026-11-02", status: "PUBLISHED" as const, content: content("Future", "Future") },
    { week_end_date: "2026-10-01", status: "PUBLISHED" as const, content: null },
  ];

  it("les 4 dernières PUBLISHED antérieures, de la plus récente à la plus ancienne", () => {
    expect(PHRASING_DEPTH).toBe(4);
    const { titres, cta } = recentPhrasing(rows, "2026-10-26");
    expect(titres).toEqual(["[joueur] règne", "Titre 12", "Titre 05"]);
    expect(cta).toEqual(["Fais mieux que [joueur].", "Cta 12"]);
  });

  it("aucun jeton, uuid ni @pseudo transmis ; texte borné", () => {
    const long = "x".repeat(PHRASING_MAX_CHARS + 50);
    const { titres, cta } = recentPhrasing(
      [{ week_end_date: "2026-10-19", status: "PUBLISHED", content: content(`@Rillettes-31 et {{u:${U2}}}`, long) }],
      "2026-10-26",
    );
    expect(titres).toEqual(["[joueur] et [joueur]"]);
    expect(JSON.stringify({ titres, cta })).not.toContain(U2);
    expect(Array.from(cta[0])).toHaveLength(PHRASING_MAX_CHARS);
  });

  it("avant la première popup : listes vides", () => {
    expect(recentPhrasing([], "2026-10-26")).toEqual({ titres: [], cta: [] });
  });
});
