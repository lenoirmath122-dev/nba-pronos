import Link from "next/link";
import type { SortKey } from "@/lib/queries/leaderboard";
import type { MyLeague } from "@/lib/queries/leagues";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée (BACKLOG_V1.md « Système de ligue », migration #16) :
// même patron que SortChips — pas d'état client, paramètre d'URL `?ligue=`,
// combiné avec `?tri=` déjà existant. N'apparaît que pour un joueur membre
// d'au moins une ligue (un visiteur, ou un joueur sans ligue, n'a rien à
// filtrer).

type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
  sortKey: SortKey;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId, sortKey }: LeagueScopeChipsProps) {
  if (myLeagues.length === 0) return null;

  function href(leagueId: string | null): string {
    const params = new URLSearchParams();
    if (sortKey !== "total") params.set("tri", sortKey);
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
