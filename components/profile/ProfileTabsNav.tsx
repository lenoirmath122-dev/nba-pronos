import Link from "next/link";
import styles from "./ProfileTabsNav.module.css";

// Barre d'onglets de « Mon profil » (Lot 3a) : 4 colonnes égales qui tiennent
// à 375 px, contrairement aux anciens onglets défilants de /stats (§1 bis du
// chantier). Liens simples (`?tab=`), aucun état client.
export const PROFILE_TABS = [
  { key: "stats", label: "Stats" },
  { key: "badges", label: "Badges" },
  { key: "historique", label: "Historique" },
  { key: "ligues", label: "Ligues" },
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number]["key"];

export function parseProfileTab(value: string | undefined): ProfileTab {
  return PROFILE_TABS.find((t) => t.key === value)?.key ?? "stats";
}

type TabsNavProps = {
  active: string;
  /** Onglets affichés ; par défaut les 4 de « Mon profil ». */
  tabs?: readonly { key: string; label: string }[];
  /** Début de l'URL d'un onglet, la clé s'ajoute au bout. */
  basePath?: string;
};

export function ProfileTabsNav({ active, tabs = PROFILE_TABS, basePath = "/profile?tab=" }: TabsNavProps) {
  return (
    <nav className={styles.tabs} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} aria-label="Sections du profil">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${basePath}${t.key}`}
          replace
          className={t.key === active ? styles.tabActive : styles.tab}
          aria-current={t.key === active ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
