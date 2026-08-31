"use client";

import { useRouter } from "next/navigation";
import type { SortDirection, SortKey } from "@/lib/queries/leaderboard";
import type { MyLeague } from "@/lib/queries/leagues";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée (BACKLOG_V1.md « Système de ligue », migration #16) :
// liste déroulante plutôt qu'une rangée de puces (demandé par l'utilisateur,
// 31/08/2026 — remplace l'ancien <nav> de <Link>) ; paramètre d'URL `?ligue=`,
// combiné avec `?tri=`/`?ordre=` (portés par les en-têtes cliquables de
// LeaderboardTable depuis le 13-14/08/2026). N'apparaît que pour un joueur
// membre d'au moins une ligue (un visiteur, ou un joueur sans ligue, n'a rien
// à filtrer).
const GENERAL_VALUE = "__general__";

type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
  sortKey: SortKey;
  sortDirection?: SortDirection;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId, sortKey, sortDirection = "desc" }: LeagueScopeChipsProps) {
  const router = useRouter();
  if (myLeagues.length === 0) return null;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const leagueId = event.target.value === GENERAL_VALUE ? null : event.target.value;
    const params = new URLSearchParams();
    if (sortKey !== "total") params.set("tri", sortKey);
    if (sortDirection === "asc") params.set("ordre", "asc");
    if (leagueId) params.set("ligue", leagueId);
    const query = params.toString();
    router.push(query ? `/leaderboard?${query}` : "/leaderboard");
  }

  return (
    <div className={styles.chips}>
      <select
        className={styles.select}
        value={activeLeagueId ?? GENERAL_VALUE}
        onChange={handleChange}
        aria-label="Filtrer par ligue"
      >
        <option value={GENERAL_VALUE}>Général</option>
        {myLeagues.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
          </option>
        ))}
      </select>
    </div>
  );
}
