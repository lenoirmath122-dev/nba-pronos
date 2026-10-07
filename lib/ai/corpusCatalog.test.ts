import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCorpusCatalog } from "./corpusCatalog";

describe("parseCorpusCatalog — format", () => {
  it("lit catégories, sous-types, effectifs et exemples", () => {
    const md = [
      "# Titre",
      "",
      "## Pari joueur — 3 paris",
      "",
      "**Points joueur** (2)",
      "> Cade marque plus de 20 points.",
      "> Jalen marque plus de 20 points",
      "",
      "**Rebonds joueur** (1)",
      "> Josh réalise plus de 10 rebonds.",
      "",
      "## Aucun pari — 1 paris",
      "**Aucun pari** (1)",
    ].join("\r\n");
    expect(parseCorpusCatalog(md)).toEqual([
      {
        name: "Pari joueur",
        total: 3,
        subtypes: [
          {
            name: "Points joueur",
            count: 2,
            examples: ["Cade marque plus de 20 points.", "Jalen marque plus de 20 points"],
          },
          { name: "Rebonds joueur", count: 1, examples: ["Josh réalise plus de 10 rebonds."] },
        ],
      },
      { name: "Aucun pari", total: 1, subtypes: [{ name: "Aucun pari", count: 1, examples: [] }] },
    ]);
  });

  it("accepte un tiret simple ou demi-cadratin dans le titre de catégorie", () => {
    expect(parseCorpusCatalog("## A - 2 paris\n## B – 1 paris").map((c) => c.total)).toEqual([2, 1]);
  });

  it("lève une erreur sur un titre ou un sous-type illisible", () => {
    expect(() => parseCorpusCatalog("## A (2 paris)")).toThrow(/illisible/);
    expect(() => parseCorpusCatalog("## A — 1 paris\n**S** (1) :")).toThrow(/illisible/);
    expect(() => parseCorpusCatalog("**S** (1)")).toThrow(/hors catégorie/);
  });

  it("une section inconnue ne rattache pas ses citations au sous-type précédent", () => {
    const cats = parseCorpusCatalog("## A — 1 paris\n**S** (1)\n> a\n### Notes\n> note");
    expect(cats[0].subtypes[0].examples).toEqual(["a"]);
  });

  it("ignore un exemple orphelin avant tout sous-type", () => {
    expect(parseCorpusCatalog("## A — 1 paris\n> orphelin")).toEqual([
      { name: "A", total: 1, subtypes: [] },
    ]);
  });
});

// Protège le format du vrai document : si quelqu'un le retouche et casse le
// parseur ou les totaux, ce test le dit avant que le rapport de routage ne
// mente.
describe("parseCorpusCatalog — types_de_paris_playoffs_2026.md", () => {
  const md = readFileSync(
    fileURLToPath(new URL("../../Cadrage/Stats/types_de_paris_playoffs_2026.md", import.meta.url)),
    "utf8",
  );
  const categories = parseCorpusCatalog(md);

  it("lit au moins une catégorie, avec des exemples", () => {
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.flatMap((c) => c.subtypes.flatMap((s) => s.examples)).length).toBeGreaterThan(0);
  });

  it("somme des catégories = total annoncé en en-tête du document", () => {
    const stated = /\*(\d+) paris personnalisés au total/.exec(md);
    expect(stated).not.toBeNull();
    expect(categories.reduce((n, c) => n + c.total, 0)).toBe(Number(stated![1]));
  });

  it("somme des sous-types = total de chaque catégorie", () => {
    for (const c of categories) {
      expect(c.subtypes.reduce((n, s) => n + s.count, 0), c.name).toBe(c.total);
    }
  });
});
