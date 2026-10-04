// Pastilles de messages non lus du chat (p3-7) : calcul pur, le repère
// localStorage et l'abonnement de la TabBar restent hors de ces tests.

import { describe, expect, it } from "vitest";
import { countUnreadByChannel, formatUnreadCount } from "./chatSeen";

describe("countUnreadByChannel", () => {
  const activity = [
    { channel: "general", createdAt: "2026-10-04T18:00:00.000Z" },
    { channel: "general", createdAt: "2026-10-04T17:00:00.000Z" },
    { channel: "league-a", createdAt: "2026-10-04T16:00:00.000Z" },
  ];

  it("compte tout sur un appareil qui n'a jamais ouvert le chat", () => {
    const counts = countUnreadByChannel(activity, {});
    expect(counts.get("general")).toBe(2);
    expect(counts.get("league-a")).toBe(1);
  });

  it("ne compte que les messages postérieurs au dernier vu du canal", () => {
    const counts = countUnreadByChannel(activity, { general: "2026-10-04T17:00:00.000Z" });
    expect(counts.get("general")).toBe(1);
    expect(counts.get("league-a")).toBe(1);
  });

  it("un canal lu jusqu'au dernier message n'a plus de non-lus", () => {
    const counts = countUnreadByChannel(activity, {
      general: "2026-10-04T18:00:00.000Z",
      "league-a": "2026-10-04T16:00:00.000Z",
    });
    expect(counts.size).toBe(0);
  });

  it("compare les dates, pas les chaînes (formats Postgres et ISO mélangés)", () => {
    const counts = countUnreadByChannel([{ channel: "general", createdAt: "2026-10-04T18:00:00+00:00" }], {
      general: "2026-10-04T18:00:00.000Z",
    });
    expect(counts.size).toBe(0);
  });
});

describe("formatUnreadCount", () => {
  it("plafonne l'affichage à 9+", () => {
    expect(formatUnreadCount(3)).toBe("3");
    expect(formatUnreadCount(12)).toBe("9+");
  });
});
