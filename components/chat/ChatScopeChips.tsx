import Link from "next/link";
import type { MyLeague } from "@/lib/queries/leagues";
import styles from "./ChatScopeChips.module.css";

// Sélecteur de canal (SPEC_CHAT_V0_1.md §1/§5) : même patron visuel que
// LeagueScopeChips (components/leaderboard/LeagueScopeChips.tsx), adapté au
// chat -- "Général" toujours affiché (contrairement au classement, où il
// n'apparaît qu'avec au moins une ligue : ici c'est le canal par défaut, pas
// un simple "retirer le filtre").

type ChatScopeChipsProps = {
  myLeagues: MyLeague[];
  activeLeagueId: string | null;
};

export function ChatScopeChips({ myLeagues, activeLeagueId }: ChatScopeChipsProps) {
  function href(leagueId: string | null): string {
    return leagueId ? `/chat?ligue=${leagueId}` : "/chat";
  }

  return (
    <nav className={styles.chips} aria-label="Choisir un canal">
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
