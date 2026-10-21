import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/lib/queries/home";
import { summarizeRecap } from "./summary";

function item(kind: FeedItem["kind"], points: number | null): FeedItem {
  return { kind, label: "x", detail: null, points, outcome: "win", occurredAt: "2026-10-21T10:00:00Z", href: null };
}

describe("summarizeRecap", () => {
  it("sépare pronos et paris et additionne les points", () => {
    const summary = summarizeRecap([item("match_scored", 3), item("bet_scored", 5), item("bet_resolved", null)]);
    expect(summary.matches).toHaveLength(1);
    expect(summary.bets).toHaveLength(2);
    expect(summary.totalPoints).toBe(8);
  });

  it("renvoie un total nul sans résultat", () => {
    expect(summarizeRecap([]).totalPoints).toBe(0);
  });
});
