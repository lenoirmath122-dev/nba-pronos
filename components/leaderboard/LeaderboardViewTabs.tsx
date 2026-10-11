import Link from "next/link";
import { leaderboardHref, type LeaderboardView } from "@/lib/leaderboard/href";
import styles from "./LeaderboardViewTabs.module.css";

// Onglets Semaine / Général du Classement (lot 2 du classement hebdo). État
// dans l'URL (`?vue=`), composant SERVEUR, même principe que PlayTabs : `active`
// vient de la page, jamais d'un état client. La ligue active est conservée.
type LeaderboardViewTabsProps = {
  active: LeaderboardView;
  leagueId: string | null;
};

export function LeaderboardViewTabs({ active, leagueId }: LeaderboardViewTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Vue du classement">
      <Link
        href={leaderboardHref({ vue: "semaine", ligue: leagueId })}
        className={active === "semaine" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "semaine" ? "page" : undefined}
      >
        Semaine
      </Link>
      <Link
        href={leaderboardHref({ vue: "general", ligue: leagueId })}
        className={active === "general" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "general" ? "page" : undefined}
      >
        Général
      </Link>
    </nav>
  );
}
