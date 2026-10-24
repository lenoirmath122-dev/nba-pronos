// Vitrine d'un joueur (D1) : épinglés d'abord, complétés par les plus hauts paliers.

import { describe, expect, it } from "vitest";
import type { BadgeDisplay } from "@/lib/queries/badges";
import { resolveShowcase } from "./showcase";

type TieredId = Extract<BadgeDisplay, { kind: "tiered" }>["id"];

const tiered = (id: TieredId, tier: "BRONZE" | "ARGENT" | "OR" | "PLATINE" | "DIAMANT" | null): BadgeDisplay => ({
  kind: "tiered",
  id,
  label: id,
  description: "",
  value: 0,
  tier,
  nextThreshold: null,
  pinned: false,
});

const sociable = (unlocked: boolean): BadgeDisplay => ({
  kind: "binary",
  id: "SOCIABLE",
  label: "Sociable",
  description: "",
  unlocked,
  pinned: false,
});

const ids = (badges: BadgeDisplay[]) => badges.map((badge) => badge.id);

describe("resolveShowcase", () => {
  const catalogue = [
    tiered("CHIRURGIEN", "OR"),
    tiered("HORLOGER", "DIAMANT"),
    tiered("OEIL_DE_LYNX", "OR"),
    tiered("METRONOME", "BRONZE"),
    tiered("MACHINE_A_PRONOS", null),
    sociable(true),
  ];

  it("choisit les plus hauts paliers quand rien n'est épinglé, à égalité le plus tardif du catalogue", () => {
    expect(ids(resolveShowcase(catalogue, [], 3))).toEqual(["HORLOGER", "OEIL_DE_LYNX", "CHIRURGIEN"]);
  });

  it("met un seul épinglé devant, puis complète", () => {
    expect(ids(resolveShowcase(catalogue, ["METRONOME"], 3))).toEqual(["METRONOME", "HORLOGER", "OEIL_DE_LYNX"]);
  });

  it("respecte l'ordre des 3 épinglés et ne complète pas", () => {
    expect(ids(resolveShowcase(catalogue, ["SOCIABLE", "CHIRURGIEN", "METRONOME"], 3))).toEqual([
      "SOCIABLE",
      "CHIRURGIEN",
      "METRONOME",
    ]);
  });

  it("ignore un épinglé devenu invalide (inconnu ou non débloqué) et un doublon", () => {
    expect(ids(resolveShowcase(catalogue, ["MACHINE_A_PRONOS", "NOPE", "HORLOGER", "HORLOGER"], 2))).toEqual([
      "HORLOGER",
      "OEIL_DE_LYNX",
    ]);
  });

  it("tronque aux `max` premiers épinglés", () => {
    expect(ids(resolveShowcase(catalogue, ["CHIRURGIEN", "HORLOGER", "METRONOME"], 1))).toEqual(["CHIRURGIEN"]);
  });

  it("renvoie une vitrine vide sans badge débloqué ou avec max à 0", () => {
    expect(resolveShowcase([tiered("CHIRURGIEN", null), sociable(false)], [], 3)).toEqual([]);
    expect(resolveShowcase(catalogue, ["HORLOGER"], 0)).toEqual([]);
  });
});
