import Link from "next/link";
import styles from "./ProfileTabs.module.css";

// Sous-onglets de Profil (réorganisation demandée par l'utilisateur,
// 30/07/2026 — l'écran avait grossi cette session : Thème, Préférences,
// Rappels, Mes ligues, Historique, Administration, Déconnexion). Même
// patron que SortChips/LeagueScopeChips (Classement) : paramètre d'URL
// `?tab=`, <Link> côté serveur, aucun état client. Déconnexion reste EN
// DEHORS de ces onglets (toujours visible, jamais à chercher).
export type ProfileTab = "compte" | "stats" | "ligues" | "historique" | "admin";

const BASE_TABS: { key: ProfileTab; label: string }[] = [
  { key: "compte", label: "Compte" },
  { key: "stats", label: "Stats" },
  { key: "ligues", label: "Ligues" },
  { key: "historique", label: "Historique" },
];

type ProfileTabsProps = {
  active: ProfileTab;
  isAdmin: boolean;
};

export function ProfileTabs({ active, isAdmin }: ProfileTabsProps) {
  const tabs = isAdmin ? [...BASE_TABS, { key: "admin" as const, label: "Admin" }] : BASE_TABS;

  return (
    <nav className={styles.chips} aria-label="Sections du profil">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.key === "compte" ? "/profile" : `/profile?tab=${tab.key}`}
          className={tab.key === active ? styles.chipActive : styles.chip}
          aria-current={tab.key === active ? "true" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
