import type { MyPredictionsMode } from "@/lib/queries/my-predictions";

// Construction d'URL partagée par SegmentTabs/FilterBar/page.tsx — l'état du
// segment/filtre vit dans l'URL, jamais dans un état client (§4.1/§4.2).
// Pas un composant (aucun JSX) : un simple utilitaire importé par des
// composants serveur, sans incidence sur la frontière "use client" (§1.1).

const BASE_PATH = "/play/my-predictions";
export const DEFAULT_LIMIT = 40;

export function buildViewPath(params: {
  mode: MyPredictionsMode;
  date?: string | null;
  seriesId?: string | null;
  limit?: number;
  leagueId?: string | null; // portée ligue (30/07/2026) — préservée à travers les autres liens
}): string {
  const sp = new URLSearchParams();
  if (params.mode === "HISTORY") sp.set("tab", "history");
  if (params.mode === "FILTERED") {
    if (params.date) sp.set("date", params.date);
    if (params.seriesId) sp.set("series", params.seriesId);
  }
  if (params.limit && params.limit !== DEFAULT_LIMIT) sp.set("limit", String(params.limit));
  if (params.leagueId) sp.set("ligue", params.leagueId);
  const qs = sp.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}
