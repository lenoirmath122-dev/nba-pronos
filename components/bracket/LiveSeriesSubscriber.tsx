"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { BracketSeriesStatus, SeriesLiveSeed } from "@/lib/queries/bracket";

// Souscription Realtime UNIQUE sur `series` (migration #14, T6c §2.2/§14.2)
// pour l'écran Bracket (vue globale) : le résultat officiel d'une série doit
// se refléter dans le résumé ET le drill-down SANS reload. Même patron que
// components/my-predictions/LiveSubscriber.tsx (Provider + consommateur dans
// le même fichier "use client", seed = état SSR, aucun revalidatePath).
//
// NodeCard (server-shaped, sans "use client" propre) lit ce contexte via
// useContext — permis parce qu'il n'est JAMAIS importé que sous un ancêtre
// client (SeriesDrillDown), même mécanisme que MarginStepper/RevealPanel
// (ETAT_ACTUEL.md §2.8) ou TeamLogo (§2.11).
//
// Le payload porte aussi `official_status` (16/08/2026, bug trouvé en audit :
// avant ce correctif, seul le vainqueur était suivi en direct — `node.status`
// restait l'instantané SSR, donc une série qui passait IN_PROGRESS ->
// FINISHED pendant que la page était ouverte restait affichée "En cours"
// avec un score figé jusqu'au rechargement, sur NodeCard ET sur le
// regroupement en colonnes de SeriesDrillDown).

type LiveSeriesState = { winner: string | null; status: BracketSeriesStatus };

const LiveSeriesContext = createContext<Map<string, LiveSeriesState> | null>(null);
const EMPTY_LIVE_SERIES_MAP = new Map<string, LiveSeriesState>();

type LiveSeriesSubscriberProps = {
  seed: SeriesLiveSeed[];
  children: ReactNode;
};

export function LiveSeriesSubscriber({ seed, children }: LiveSeriesSubscriberProps) {
  const [liveSeries, setLiveSeries] = useState<Map<string, LiveSeriesState>>(() => new Map());

  useEffect(() => {
    if (seed.length === 0) return;

    const seedBySeriesId = new Map(seed.map((row) => [row.seriesId, row]));

    function applyPayload(payload: {
      new: { id: string; official_status: BracketSeriesStatus; official_winner_team_id: string | null };
    }) {
      const row = payload.new;
      const teams = seedBySeriesId.get(row.id);
      if (!teams) return; // série hors de cette page

      const winner =
        row.official_winner_team_id === null
          ? null
          : row.official_winner_team_id === teams.teamAId
            ? teams.teamAAbbreviation
            : row.official_winner_team_id === teams.teamBId
              ? teams.teamBAbbreviation
              : null; // ne devrait pas arriver (garde défensive)

      setLiveSeries((prev) => {
        const next = new Map(prev);
        next.set(row.id, { winner, status: row.official_status });
        return next;
      });
    }

    const supabase = getBrowserClient();
    const channel = supabase
      .channel("bracket-series")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "series" }, applyPayload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seed]);

  return <LiveSeriesContext.Provider value={liveSeries}>{children}</LiveSeriesContext.Provider>;
}

/** À utiliser dans NodeCard : renvoie le vainqueur live si un événement est
 *  déjà arrivé pour cette série, sinon `fallback` (la valeur SSR). */
export function useLiveWinnerAbbreviation(seriesId: string, fallback: string | null): string | null {
  const map = useContext(LiveSeriesContext);
  const entry = map?.get(seriesId);
  return entry ? entry.winner : fallback;
}

/** À utiliser dans NodeCard : renvoie le statut live si un événement est déjà
 *  arrivé pour cette série, sinon `fallback` (la valeur SSR). */
export function useLiveSeriesStatus(seriesId: string, fallback: BracketSeriesStatus): BracketSeriesStatus {
  const map = useContext(LiveSeriesContext);
  const entry = map?.get(seriesId);
  return entry ? entry.status : fallback;
}

/** À utiliser dans SeriesDrillDown : la carte "en cours"/"repliée" d'une
 *  colonne dépend du statut, donc du même live-tracking — exposé en Map brute
 *  ici (pas un hook par série) car le regroupement se fait dans un
 *  `.filter()`, où appeler un hook par itération violerait les règles des
 *  Hooks. */
export function useLiveSeriesMap(): Map<string, LiveSeriesState> {
  return useContext(LiveSeriesContext) ?? EMPTY_LIVE_SERIES_MAP;
}
