import { describe, expect, it } from "vitest";
import { broadcastBandColor, TEAM_COLORS } from "./teamColors";

describe("broadcastBandColor", () => {
  it("prend la primaire de l'équipe", () => {
    expect(broadcastBandColor("BOS")).toBe(TEAM_COLORS.BOS.primary);
    expect(broadcastBandColor("LAL")).toBe(TEAM_COLORS.LAL.primary);
  });

  it("bascule sur la secondaire quand la primaire est trop claire pour du texte blanc", () => {
    expect(broadcastBandColor("SAS")).toBe(TEAM_COLORS.SAS.secondary);
  });

  it("renvoie null pour une équipe inconnue (repli sur l'accent)", () => {
    expect(broadcastBandColor("E2H")).toBeNull();
  });

  it("le texte blanc reste lisible sur la bande de chaque équipe (contraste >= 3, texte large)", () => {
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    for (const abbreviation of Object.keys(TEAM_COLORS)) {
      const n = parseInt(broadcastBandColor(abbreviation)!.slice(1), 16);
      const lum = 0.2126 * channel((n >> 16) & 0xff) + 0.7152 * channel((n >> 8) & 0xff) + 0.0722 * channel(n & 0xff);
      expect(1.05 / (lum + 0.05), abbreviation).toBeGreaterThanOrEqual(3);
    }
  });
});
