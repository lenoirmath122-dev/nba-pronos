import Link from "next/link";
import styles from "./PlayTabs.module.css";

// Les 2 onglets de "Jouer" (décision 2, SPEC_REFONTE_ONGLET_JOUER_V0_1) —
// remplace le hub à cartes. État dans l'URL (route elle-même : /play vs
// /play/results), pas un état client — composant SERVEUR, même principe que
// l'ex-SegmentTabs de Mes pronos. `active` est passé par la page appelante,
// jamais dérivé d'un pathname côté client.

type PlayTabsProps = { active: "UPCOMING" | "RESULTS" };

export function PlayTabs({ active }: PlayTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Onglet Jouer">
      <Link
        href="/play"
        className={active === "UPCOMING" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "UPCOMING" ? "page" : undefined}
      >
        Mes pronos
      </Link>
      <Link
        href="/play/results"
        className={active === "RESULTS" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        aria-current={active === "RESULTS" ? "page" : undefined}
      >
        Résultats
      </Link>
    </nav>
  );
}
