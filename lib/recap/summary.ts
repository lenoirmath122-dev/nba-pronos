import type { FeedItem } from "@/lib/queries/home";

export type RecapSummary = {
  matches: FeedItem[];
  bets: FeedItem[];
  totalPoints: number;
};

/** Sépare les pronos de match des paris et totalise les points gagnés. */
export function summarizeRecap(items: FeedItem[]): RecapSummary {
  return {
    matches: items.filter((item) => item.kind === "match_scored"),
    bets: items.filter((item) => item.kind !== "match_scored"),
    totalPoints: items.reduce((sum, item) => sum + (item.points ?? 0), 0),
  };
}
