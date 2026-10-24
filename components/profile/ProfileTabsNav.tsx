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

export function ProfileTabsNav({ active }: { active: ProfileTab }) {
  return (
    <nav className={styles.tabs} aria-label="Sections du profil">
      {PROFILE_TABS.map((t) => (
        <Link
          key={t.key}
          href={`/profile?tab=${t.key}`}
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
