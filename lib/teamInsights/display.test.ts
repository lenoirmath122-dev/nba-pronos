import { describe, expect, it } from "vitest";
import { formAriaLabel, formatSignedDiff } from "./display";
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
