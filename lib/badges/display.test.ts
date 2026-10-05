// Popup « nouveau badge » (p3-9) : calcul pur des badges pas encore montrés
// sur l'appareil ; le repère localStorage reste hors de ces tests.

import { describe, expect, it } from "vitest";
import type { BadgeDisplay } from "@/lib/queries/badges";
import { seenSnapshot, tierRank, unseenBadges } from "./display";

const horloger = (tier: "BRONZE" | "OR" | null): BadgeDisplay => ({
  kind: "tiered",
  id: "HORLOGER",
  label: "Buzzer-beater",
  description: "Écarts exacts trouvés",
  value: tier === "OR" ? 15 : tier === "BRONZE" ? 3 : 1,
  tier,
  nextThreshold: 30,
  pinned: false,
});

const sociable = (unlocked: boolean): BadgeDisplay => ({
  kind: "binary",
  id: "SOCIABLE",
  label: "Sociable",
  description: "A rejoint ou créé au moins une ligue",
  unlocked,
  pinned: false,
});

describe("unseenBadges", () => {
  it("montre tous les badges débloqués sur un appareil qui n'a rien vu", () => {
    const result = unseenBadges([horloger("BRONZE"), sociable(true)], {});
    expect(result.map((b) => b.id)).toEqual(["HORLOGER", "SOCIABLE"]);
  });

  it("ignore les badges verrouillés", () => {
    expect(unseenBadges([horloger(null), sociable(false)], {})).toEqual([]);
  });

  it("ne remontre pas un badge déjà vu au même palier", () => {
    expect(unseenBadges([horloger("BRONZE"), sociable(true)], { HORLOGER: "BRONZE", SOCIABLE: "1" })).toEqual([]);
  });

  it("remontre un badge passé à un palier supérieur", () => {
    const result = unseenBadges([horloger("OR")], { HORLOGER: "BRONZE" });
    expect(result.map((b) => b.id)).toEqual(["HORLOGER"]);
  });
});

describe("seenSnapshot", () => {
  it("retient le palier des badges débloqués seulement", () => {
    expect(seenSnapshot([horloger("OR"), sociable(true), sociable(false)])).toEqual({ HORLOGER: "OR", SOCIABLE: "1" });
  });
});

describe("tierRank", () => {
  it("vaut 1 à 5 selon le palier, 0 sinon", () => {
    expect(tierRank(horloger("BRONZE"))).toBe(1);
    expect(tierRank(horloger("OR"))).toBe(3);
    expect(tierRank(horloger(null))).toBe(0);
    expect(tierRank(sociable(true))).toBe(0);
  });
});
