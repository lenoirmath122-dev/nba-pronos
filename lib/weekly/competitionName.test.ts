import { describe, it, expect } from "vitest";
import { nextCompetitionName } from "./competitionName";

describe("nextCompetitionName", () => {
  it("0 semaine figée : Semaine 1, déjà à jour", () => {
    expect(nextCompetitionName("Saison régulière - Semaine 1", 0)).toBeNull();
  });

  it("1 semaine figée : passe à Semaine 2", () => {
    expect(nextCompetitionName("Saison régulière - Semaine 1", 1)).toBe("Saison régulière - Semaine 2");
  });

  it("rattrape un retard de plusieurs semaines", () => {
    expect(nextCompetitionName("Saison régulière - Semaine 2", 9)).toBe("Saison régulière - Semaine 10");
  });

  it("idempotent : le 2e et 3e passage du cron ne changent rien", () => {
    expect(nextCompetitionName("Saison régulière - Semaine 2", 1)).toBeNull();
  });

  it("nom saisi à la main : jamais écrasé", () => {
    expect(nextCompetitionName("Saison régulière - entrainement", 3)).toBeNull();
    expect(nextCompetitionName("Alpha NBA Cup", 3)).toBeNull();
  });
});
