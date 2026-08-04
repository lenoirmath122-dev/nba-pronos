import Link from "next/link";
import type { MyLeague } from "@/lib/queries/leagues";
import styles from "./LeagueScopeChips.module.css";

// Sélecteur de portée par ligue pour la section Comparaison de l'onglet
// Stats (04/08/2026, demandé par l'utilisateur) — même patron que
// components/bracket/LeagueScopeChips.tsx / components/leaderboard/
// LeagueScopeChips.tsx : pas d'état client, paramètre d'URL `?ligue=`,
// une copie dédiée par écran (href en dur) plutôt qu'un composant générique
// partagé, convention déjà établie dans ce projet. `tab=stats` toujours
// préservé — ce filtre n'existe que dans cet onglet.
type LeagueScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
};

export function LeagueScopeChips({ myLeagues, activeLeagueId }: LeagueScopeChipsProps) {
  if (myLeagues.length === 0) return null;

  function href(leagueId: string | null): string {
    const params = new URLSearchParams({ tab: "stats" });
    if (leagueId) params.set("ligue", leagueId);
    return `/profile?${params.toString()}`;
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
