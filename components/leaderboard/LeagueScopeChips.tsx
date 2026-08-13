import Link from "next/link";
import type { SortDirection, SortKey } from "@/lib/queries/leaderboard";
import type { MyLeague } from "@/lib/queries/leagues";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée (BACKLOG_V1.md « Système de ligue », migration #16) :
// pas d'état client, paramètre d'URL `?ligue=`, combiné avec `?tri=`/`?ordre=`
// (portés par les en-têtes cliquables de LeaderboardTable depuis le
// 13-14/08/2026). N'apparaît que pour un joueur membre d'au moins une ligue
// (un visiteur, ou un joueur sans ligue, n'a rien à filtrer).

type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
  sortKey: SortKey;
  sortDirection?: SortDirection;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId, sortKey, sortDirection = "desc" }: LeagueScopeChipsProps) {
  if (myLeagues.length === 0) return null;

  function href(leagueId: string | null): string {
    const params = new URLSearchParams();
    if (sortKey !== "total") params.set("tri", sortKey);
    if (sortDirection === "asc") params.set("ordre", "asc");
    if (leagueId) params.set("ligue", leagueId);
    const query = params.toString();
    return query ? `/leaderboard?${query}` : "/leaderboard";
  }

  return (
    <nav className={styles.chips} aria-label="Filtrer par ligue">
      <Link
        href={href(null)}
        className={activeLeagueId === null ? styles.chipActive : styles.chip}
        aria-current={activeLeagueId === null ? "true" : undefined}
      >
        Général
      </Link>
      {myLeagues.map((league) => (
        <Link
          key={league.id}
          href={href(league.id)}
          className={league.id === activeLeagueId ? styles.chipActive : styles.chip}
          aria-current={league.id === activeLeagueId ? "true" : undefined}
        >
          {league.name}
        </Link>
      ))}
    </nav>
  );
}
