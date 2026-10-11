"use client";

import { useRouter } from "next/navigation";
import type { SortDirection, SortKey } from "@/lib/queries/leaderboard";
import type { MyLeague } from "@/lib/queries/leagues";
import { leaderboardHref, type LeaderboardView } from "@/lib/leaderboard/href";
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
  /** Vue du classement hebdo, absente tant que le classement hebdo est
   *  inactif (les liens restent alors identiques à ceux d'avant). En vue
   *  Semaine, tri et ordre n'existent pas et ne sont pas reportés. */
  vue?: LeaderboardView;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId, sortKey, sortDirection = "desc", vue }: LeagueScopeChipsProps) {
  const router = useRouter();
  if (myLeagues.length === 0) return null;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const leagueId = event.target.value === GENERAL_VALUE ? null : event.target.value;
    const keepSort = vue !== "semaine";
    router.push(
      leaderboardHref({
        vue,
        tri: keepSort ? sortKey : undefined,
        ordre: keepSort ? sortDirection : undefined,
        ligue: leagueId,
      }),
    );
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
