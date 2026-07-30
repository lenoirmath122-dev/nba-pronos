import Link from "next/link";
import { buildViewPath } from "./urls";
import styles from "./SegmentTabs.module.css";

// Segments Récent/Historique (§4.1) — état dans l'URL, liens serveur natifs.
// N'apparaît QUE quand aucun filtre n'est actif (remplacé par une puce de
// filtre sinon, §4.3 — décidé par la page appelante).

type SegmentTabsProps = { active: "RECENT" | "HISTORY"; leagueId?: string | null };

export function SegmentTabs({ active, leagueId }: SegmentTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Segment">
      <Link
        href={buildViewPath({ mode: "RECENT", leagueId })}
        className={active === "RECENT" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "RECENT" ? "page" : undefined}
      >
        Récent
      </Link>
      <Link
        href={buildViewPath({ mode: "HISTORY", leagueId })}
        className={active === "HISTORY" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "HISTORY" ? "page" : undefined}
      >
        Historique
      </Link>
    </nav>
  );
}
