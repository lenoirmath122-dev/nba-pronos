// Résumé de l'onglet Badges : compteur et badges les plus proches d'un palier.

import { describe, expect, it } from "vitest";
import type { BadgeDisplay } from "@/lib/queries/badges";
import { closestBadges, countUnlocked, tierThresholds } from "./summary";

type TieredId = Extract<BadgeDisplay, { kind: "tiered" }>["id"];
type Tier = "BRONZE" | "ARGENT" | "OR" | "PLATINE" | "DIAMANT" | null;

const tiered = (id: TieredId, value: number, tier: Tier, nextThreshold: number | null): BadgeDisplay => ({
  kind: "tiered",
  id,
  label: id,
  description: "",
  value,
  tier,
  nextThreshold,
  pinned: false,
});

const ladder = (value: number, threshold: number): BadgeDisplay => ({
  kind: "ladderStep",
  id: "JOUEUR",
  label: "Joueur",
  description: "",
  level: 2,
  value,
  unlocked: value >= threshold,
  threshold,
  pinned: false,
});

const binary = (unlocked: boolean): BadgeDisplay => ({
  kind: "binary",
  id: "SOCIABLE",
  label: "Sociable",
  description: "",
  unlocked,
  pinned: false,
});

describe("countUnlocked", () => {
  it("compte les badges à palier atteint, binaires et marches débloqués", () => {
    const badges = [tiered("CHIRURGIEN", 12, "BRONZE", 25), tiered("HORLOGER", 1, null, 3), binary(true), ladder(5, 5), ladder(1, 5)];
    expect(countUnlocked(badges)).toBe(3);
  });
});

describe("closestBadges", () => {
  it("classe par pourcentage du prochain seuil et nomme le palier visé", () => {
    const badges = [tiered("CHIRURGIEN", 12, "BRONZE", 25), tiered("HORLOGER", 7, "BRONZE", 8)];
    const result = closestBadges(badges, 3);
    expect(result.map((r) => r.badge.id)).toEqual(["HORLOGER", "CHIRURGIEN"]);
    expect(result[0]).toMatchObject({ remaining: 1, target: "Argent" });
  });

  it("vise Bronze quand le badge n'a pas encore de palier", () => {
    const [first] = closestBadges([tiered("HORLOGER", 2, null, 3)], 1);
    expect(first).toMatchObject({ remaining: 1, target: "Bronze" });
  });

  it("exclut compteur à 0, palier maximum, binaire et marche déjà débloquée", () => {
    const badges = [tiered("CHIRURGIEN", 0, null, 10), tiered("HORLOGER", 60, "DIAMANT", null), binary(false), ladder(5, 5)];
    expect(closestBadges(badges, 3)).toEqual([]);
  });

  it("compte une marche de l'échelle verrouillée", () => {
    const [first] = closestBadges([ladder(4, 5)], 1);
    expect(first).toMatchObject({ remaining: 1, target: "le badge" });
  });

  it("respecte la limite", () => {
    const badges = [tiered("CHIRURGIEN", 5, null, 10), tiered("HORLOGER", 2, null, 3), ladder(1, 5)];
    expect(closestBadges(badges, 2)).toHaveLength(2);
    expect(closestBadges(badges, 0)).toEqual([]);
  });
});

describe("tierThresholds", () => {
  it("donne les 5 seuils d'un badge à paliers, rien sinon", () => {
    expect(tierThresholds(tiered("CHIRURGIEN", 0, null, 10))).toEqual([10, 25, 50, 100, 200]);
    expect(tierThresholds(binary(true))).toEqual([]);
  });
});
