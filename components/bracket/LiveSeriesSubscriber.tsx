"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { SeriesLiveSeed } from "@/lib/queries/bracket";

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

const LiveWinnersContext = createContext<Map<string, string | null> | null>(null);

type LiveSeriesSubscriberProps = {
  seed: SeriesLiveSeed[];
  children: ReactNode;
};

export function LiveSeriesSubscriber({ seed, children }: LiveSeriesSubscriberProps) {
  const [liveWinners, setLiveWinners] = useState<Map<string, string | null>>(() => new Map());

  useEffect(() => {
    if (seed.length === 0) return;

    const seedBySeriesId = new Map(seed.map((row) => [row.seriesId, row]));

    function applyPayload(payload: { new: { id: string; official_winner_team_id: string | null } }) {
      const row = payload.new;
      const teams = seedBySeriesId.get(row.id);
      if (!teams) return; // série hors de cette page

      const abbreviation =
        row.official_winner_team_id === null
          ? null
          : row.official_winner_team_id === teams.teamAId
            ? teams.teamAAbbreviation
            : row.official_winner_team_id === teams.teamBId
              ? teams.teamBAbbreviation
              : null; // ne devrait pas arriver (garde défensive)

      setLiveWinners((prev) => {
        const next = new Map(prev);
        next.set(row.id, abbreviation);
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

  return <LiveWinnersContext.Provider value={liveWinners}>{children}</LiveWinnersContext.Provider>;
}

/** À utiliser dans NodeCard : renvoie le vainqueur live si un événement est
 *  déjà arrivé pour cette série, sinon `fallback` (la valeur SSR). */
export function useLiveWinnerAbbreviation(seriesId: string, fallback: string | null): string | null {
  const map = useContext(LiveWinnersContext);
  if (!map || !map.has(seriesId)) return fallback;
  return map.get(seriesId) ?? null;
}
