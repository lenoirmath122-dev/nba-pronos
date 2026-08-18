import Link from "next/link";
import type { MyLeague } from "@/lib/queries/leagues";
import { buildResultsPath } from "./urls";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée par ligue sur l'onglet Résultats — même patron que
// components/leaderboard/LeagueScopeChips.tsx (Classement) : pas d'état
// client, paramètre d'URL ?ligue=. N'apparaît que pour un joueur membre d'au
// moins une ligue. Ex-components/my-predictions/LeagueScopeChips.tsx —
// n'existe plus que sur Résultats (pas de sélecteur sur Mes pronos, cf.
// SPEC_REFONTE_ONGLET_JOUER_V0_1 : les matchs pas encore verrouillés n'ont
// jamais eu de portée par ligue, et les verrouillés récents la perdent par
// simplification assumée à la fusion).
type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
  date?: string | null;
  seriesId?: string | null;
  limit?: number;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId, date, seriesId, limit }: LeagueScopeChipsProps) {
  if (myLeagues.length === 0) return null;

  function href(leagueId: string | null): string {
    return buildResultsPath({ date, seriesId, limit, leagueId });
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
