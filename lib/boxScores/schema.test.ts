import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { boxScorePath, boxScoreSheetSchema, boxScoreUrl, shootingLine } from "./schema";

// Contrat Python <-> TypeScript : la fixture est produite par box_scores.py
// (Cadrage/Stats/service/tests/test_box_scores.py la vérifie côté Python).
const fixture = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../Cadrage/Stats/service/tests/fixtures/box_score_reduced.json"), "utf-8")
);

describe("boxScoreSheetSchema", () => {
  it("lit la feuille produite par la VM", () => {
    const sheet = boxScoreSheetSchema.parse(fixture);
    const [away, home] = sheet.teams;
    expect([away.side, away.tricode, away.score]).toEqual(["away", "MIN", 112]);
    expect([home.side, home.tricode, home.score]).toEqual(["home", "IND", 123]);
    expect(home.players.slice(0, 5).every((p) => p.starter)).toBe(true);
    expect(home.dnp).toHaveLength(1);
  });

  it("refuse une version inconnue plutôt que d'afficher n'importe quoi", () => {
    expect(boxScoreSheetSchema.safeParse({ ...fixture, v: 2 }).success).toBe(false);
  });
});

describe("boxScorePath", () => {
  it("trie les tricodes et prend le jour NY", () => {
    // 23h30 UTC le 7 = 19h30 à New York le 7.
    expect(boxScorePath("2026-10-07T23:30:00Z", "MIN", "IND")).toBe("2026-10-07/IND-MIN.json");
    expect(boxScorePath("2026-10-07T23:30:00Z", "IND", "MIN")).toBe("2026-10-07/IND-MIN.json");
  });

  it("garde le jour NY du coup d'envoi pour un match tardif (déjà le lendemain en UTC)", () => {
    // 02h30 UTC le 8 = 22h30 à New York le 7.
    expect(boxScorePath("2026-10-08T02:30:00Z", "LAL", "GSW")).toBe("2026-10-07/GSW-LAL.json");
  });
});

describe("boxScoreUrl", () => {
  it("pointe sur l'URL publique du bucket", () => {
    expect(boxScoreUrl("https://x.supabase.co/", "2026-10-07/IND-MIN.json")).toBe(
      "https://x.supabase.co/storage/v1/object/public/box-scores/2026-10-07/IND-MIN.json"
    );
  });
});

describe("shootingLine", () => {
  it("arrondit le pourcentage et n'en affiche pas sans tir", () => {
    expect(shootingLine(12, 25)).toEqual({ ratio: "12/25", pct: "48 %" });
    expect(shootingLine(0, 0)).toEqual({ ratio: "0/0", pct: null });
  });
});
