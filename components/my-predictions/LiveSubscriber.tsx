"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { MatchLiveState } from "@/lib/queries/my-predictions";
import styles from "./LiveSubscriber.module.css";

// SEUL composant client de l'écran "Mes pronos" (§1.1) : une souscription
// Realtime UNIQUE sur `matches` (migration #8), restreinte EN MÉMOIRE aux
// matchId réellement présents sur la page (aucun filtre serveur — la RLS
// matches_select est déjà `using (true)`, filtrer côté client suffit et évite
// toute dépendance à une syntaxe de filtre postgres_changes non vérifiée).
// Met à jour le CONTENU d'une ligne (statut, score) — JAMAIS l'ordre ni la
// composition de la liste (§5.2/§5.3), qui restent figés au chargement.
//
// Regroupe le Provider (LiveSubscriber) ET le consommateur (LiveBadgeAndScore)
// dans le MÊME fichier "use client" : React exige un composant client pour
// lire un contexte depuis l'intérieur de lignes par ailleurs SERVEUR
// (MatchRowStatic), mais la frontière reste UNIQUE pour l'écran (§1.1) — ce
// n'est pas un second "use client", c'est le même fichier qui exporte deux
// éléments d'un seul et même mécanisme.

type LiveMatchState = { liveState: MatchLiveState; homeScore: number | null; awayScore: number | null };

const LiveMatchesContext = createContext<Map<string, LiveMatchState> | null>(null);

function toLiveStateFromRaw(status: string): MatchLiveState {
  switch (status) {
    case "IN_PROGRESS":
      return "LIVE";
    case "FINISHED":
      return "FINISHED";
    case "POSTPONED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      // Le planificateur (30-60 min, T4) n'est pas encore passé sur ce match
      // pourtant déjà commencé — latence assumée (§5.4).
      return "STARTED";
  }
}

type LiveSubscriberProps = {
  seed: { matchId: string; liveState: MatchLiveState; homeScore: number | null; awayScore: number | null }[];
  children: ReactNode;
};

export function LiveSubscriber({ seed, children }: LiveSubscriberProps) {
  const [liveMap, setLiveMap] = useState<Map<string, LiveMatchState>>(
    () => new Map(seed.map((s) => [s.matchId, { liveState: s.liveState, homeScore: s.homeScore, awayScore: s.awayScore }]))
  );

  useEffect(() => {
    const matchIds = new Set(seed.map((s) => s.matchId));
    if (matchIds.size === 0) return;

    function applyPayload(payload: {
      new: { id: string; status: string; home_score: number | null; away_score: number | null };
    }) {
      const row = payload.new;
      if (!matchIds.has(row.id)) return; // hors des matchs de cette page
      setLiveMap((prev) => {
        const next = new Map(prev);
        next.set(row.id, {
          liveState: toLiveStateFromRaw(row.status),
          homeScore: row.home_score,
          awayScore: row.away_score,
        });
        return next;
      });
    }

    const supabase = getBrowserClient();
    const channel = supabase
      .channel("my-predictions-matches")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        applyPayload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [seed]);

  return <LiveMatchesContext.Provider value={liveMap}>{children}</LiveMatchesContext.Provider>;
}

type LiveBadgeAndScoreProps = {
  matchId: string;
  fallback: LiveMatchState;
  scheduledAtLabel: string;
};

/** Rendu du bloc live d'UNE ligne — consomme le contexte posé par
 *  LiveSubscriber ci-dessus. `fallback` = donnée SSR (seed), utilisée tant
 *  qu'aucun événement Realtime n'est encore arrivé pour ce match. */
export function LiveBadgeAndScore({ matchId, fallback, scheduledAtLabel }: LiveBadgeAndScoreProps) {
  const map = useContext(LiveMatchesContext);
  const state = map?.get(matchId) ?? fallback;
  const score = state.homeScore !== null && state.awayScore !== null ? `${state.homeScore}-${state.awayScore}` : "—";

  if (state.liveState === "LIVE") {
    return (
      <span className={styles.live}>
        <span className={styles.liveBadge}>EN DIRECT</span>
        <span className={styles.score}>{score}</span>
      </span>
    );
  }
  if (state.liveState === "FINISHED") {
    return <span className={styles.score}>{score}</span>;
  }
  if (state.liveState === "POSTPONED") {
    return <span className={styles.meta}>Reporté</span>;
  }
  if (state.liveState === "CANCELLED") {
    return <span className={styles.meta}>Annulé</span>;
  }
  // STARTED : latence du planificateur — le live est indicatif, jamais une
  // horloge officielle (§5.4). On affiche l'heure prévue, pas un faux badge.
  return <span className={styles.meta}>{scheduledAtLabel}</span>;
}
