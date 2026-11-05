import { describe, expect, it } from "vitest";
import {
  abbreviateName,
  formAriaLabel,
  formatConferenceRank,
  formatPercent,
  formatSignedDiff,
  formatStreak,
  last5AriaLabel,
} from "./display";
import type { TeamFormSummary } from "./types";

const form: TeamFormSummary = {
  record: { wins: 7, losses: 2 },
  last5: ["V", "V", "D", "V", "V"],
  streak: { type: "V", length: 2 },
  pointDiffLast5: 6.4,
  label: "EN_FEU",
  conferenceRank: 3,
  conference: "WEST",
};

describe("formAriaLabel", () => {
  it("décrit bilan, 5 derniers et étiquette en toutes lettres", () => {
    expect(formAriaLabel("Lakers", form)).toBe(
      "Lakers : 7 victoires 2 défaites, 4 victoires sur les 5 derniers matchs, en feu"
    );
  });
});

describe("formatSignedDiff", () => {
  it("signe et virgule française", () => {
    expect(formatSignedDiff(6.44)).toBe("+6,4");
    expect(formatSignedDiff(-0.1)).toBe("-0,1");
    expect(formatSignedDiff(0)).toBe("0");
  });
});

describe("aide aux débutants : formats de la popup à onglets", () => {
  it("abrège les prénoms mais garde les initiales", () => {
    expect(abbreviateName("Stephen Curry")).toBe("S. Curry");
    expect(abbreviateName("Giannis Antetokounmpo")).toBe("G. Antetokounmpo");
    expect(abbreviateName("LJ Cryer")).toBe("LJ Cryer");
    expect(abbreviateName("Nikola Jokić Jr.")).toBe("N. Jokić Jr.");
    expect(abbreviateName("Nene")).toBe("Nene");
  });
  it("libellé des traits", () => {
    expect(last5AriaLabel(["V", "D", "V", "V", "D"])).toBe("5 derniers matchs : 3 victoires, 2 défaites");
    expect(last5AriaLabel(["V"])).toBe("Dernier match : 1 victoire, 0 défaite");
  });
  it("série, classement, pourcentage", () => {
    expect(formatStreak({ type: "V", length: 5 })).toBe("5 V");
    expect(formatConferenceRank(8, "WEST")).toBe("8e Ouest");
    expect(formatConferenceRank(1, "EAST")).toBe("1er Est");
    expect(formatConferenceRank(null, null)).toBe("–");
    expect(formatPercent(null)).toBe("–");
    expect(formatPercent(0.474)).toBe("47 %");
  });
});
