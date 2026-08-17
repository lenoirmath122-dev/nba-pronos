import Link from "next/link";
import type { MyLeague } from "@/lib/queries/leagues";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée par ligue (30/07/2026, demandé par l'utilisateur : le
// Bracket montrait toujours TOUS les joueurs) — même patron que
// components/leaderboard/LeagueScopeChips.tsx (Classement) : pas d'état
// client, paramètre d'URL `?ligue=`. N'apparaît que pour un joueur membre
// d'au moins une ligue. Ne préserve plus `?arbre=` (17/08/2026, retiré : la
// Vue B est désormais toujours l'écran d'arrivée, cf. TreeView.tsx).
type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId }: LeagueScopeChipsProps) {
  if (myLeagues.length === 0) return null;

  function href(leagueId: string | null): string {
    return leagueId ? `/bracket?ligue=${leagueId}` : "/bracket";
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
