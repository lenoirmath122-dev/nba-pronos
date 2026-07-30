import Link from "next/link";
import type { MyPredictionsMode } from "@/lib/queries/my-predictions";
import type { MyLeague } from "@/lib/queries/leagues";
import { buildViewPath } from "./urls";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée par ligue (30/07/2026, demandé par l'utilisateur :
// "Mes pronos"/Bracket montrent toujours TOUS les joueurs) — même patron que
// components/leaderboard/LeagueScopeChips.tsx (Classement) : pas d'état
// client, paramètre d'URL `?ligue=`, préservé à travers les autres liens de
// l'écran via buildViewPath. N'apparaît que pour un joueur membre d'au moins
// une ligue.
type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
  mode: MyPredictionsMode;
  date?: string | null;
  seriesId?: string | null;
  limit?: number;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId, mode, date, seriesId, limit }: LeagueScopeChipsProps) {
  if (myLeagues.length === 0) return null;

  function href(leagueId: string | null): string {
    return buildViewPath({ mode, date, seriesId, limit, leagueId });
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
