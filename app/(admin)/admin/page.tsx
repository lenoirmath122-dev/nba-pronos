import Link from "next/link";
import { getAdminDashboardData, getPendingTotal } from "@/lib/queries/admin-dashboard";
import { ADMIN_SECTIONS } from "@/lib/admin/navigation";
import styles from "./page.module.css";

// Tableau de bord admin (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1) : quatre rubriques
// en cartes « tiroir » (lib/admin/navigation.ts), le détail vit dans chaque
// page de rubrique. Composant serveur, sans feuille « use client ».

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  const pendingTotal = getPendingTotal(data);
  const alertActive = data.unidentifiedPlayerCount > 0 || data.weeklyPopupDoubtful > 0;

  const drawers = [
    {
      section: ADMIN_SECTIONS.todo,
      summary:
        pendingTotal > 0 ? (
          <span className={alertActive ? styles.badgeAlert : styles.badge}>{pendingTotal}</span>
        ) : (
          <span className={styles.badgeEmpty}>Rien à traiter</span>
        ),
    },
    {
      section: ADMIN_SECTIONS.game,
      summary: data.competitionName ?? "Aucune compétition en cours",
    },
    {
      section: ADMIN_SECTIONS.community,
      summary: `${data.totalPlayers} ${data.totalPlayers > 1 ? "inscrits" : "inscrit"} · ${data.leagues.length} ${
        data.leagues.length > 1 ? "ligues" : "ligue"
      }`,
    },
    { section: ADMIN_SECTIONS.system, summary: "Logs, synchro, sécurité" },
  ];

  return (
    <div className={styles.page}>
      {!data.competitionId && (
        <p className={styles.notice}>Aucune compétition en cours. La prochaine arrive bientôt.</p>
      )}

      <ul className={styles.drawerList}>
        {drawers.map(({ section, summary }) => (
          <li key={section.slug}>
            <Link href={section.href} className={styles.drawer}>
              <span className={styles.drawerText}>
                <span className={styles.drawerTitle}>{section.label}</span>
                <span className={styles.drawerSummary}>{summary}</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
