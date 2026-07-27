import Link from "next/link";
import styles from "./SegmentTabs.module.css";

// Segments En cours/Terminés (SPEC_ECRAN_MES_PARIS_V0_1 §6) — état dans
// l'URL, liens serveur natifs. Découpage PAR STATUT (pas par récence comme
// Mes pronos) : plus pertinent pour un portefeuille de paris.

type SegmentTabsProps = { active: "ONGOING" | "FINISHED" };

export function SegmentTabs({ active }: SegmentTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Segment">
      <Link
        href="/play/bets?segment=ONGOING"
        className={active === "ONGOING" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "ONGOING" ? "page" : undefined}
      >
        En cours
      </Link>
      <Link
        href="/play/bets?segment=FINISHED"
        className={active === "FINISHED" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "FINISHED" ? "page" : undefined}
      >
        Terminés
      </Link>
    </nav>
  );
}
