import Link from "next/link";
import styles from "./RoundTabs.module.css";

// Navigation par tour (SPEC_ECRAN_BRACKET_PERSONNEL_V0_1 §6) — liens serveur
// natifs (?round=), pas d'état client : cohérent avec SegmentTabs (Mes
// pronos), pas besoin d'interactivité pour changer d'onglet.
type RoundTabsProps = {
  rounds: { key: string; label: string }[];
  activeKey: string | undefined;
};

export function RoundTabs({ rounds, activeKey }: RoundTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Tour du bracket">
      {rounds.map((round) => (
        <Link
          key={round.key}
          href={`/play/bracket?round=${round.key}`}
          className={round.key === activeKey ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          aria-current={round.key === activeKey ? "page" : undefined}
        >
          {round.label}
        </Link>
      ))}
    </nav>
  );
}
