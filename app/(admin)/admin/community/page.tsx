import Link from "next/link";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import styles from "@/components/admin/AdminHub.module.css";

// Rubrique « Joueurs » : total d'inscrits (lien vers la gestion des joueurs)
// et membres par ligue -- RLS admin dédiée, voir lib/queries/admin-dashboard.ts.

export default async function AdminCommunityPage() {
  const data = await getAdminDashboardData();

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Joueurs</h2>

      <ul className={styles.cardList}>
        <li>
          <Link href="/admin/players" className={styles.cardLink}>
            <span className={styles.count}>{data.totalPlayers}</span>
            <span className={styles.cardLabel}>{data.totalPlayers > 1 ? "joueurs inscrits" : "joueur inscrit"}</span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      </ul>

      <div className={styles.overview}>
        <h3 className={styles.sectionTitle}>Ligues</h3>
        {data.leagues.length > 0 ? (
          <ul className={styles.leagueList}>
            {data.leagues.map((league) => (
              <li key={league.id} className={styles.leagueRow}>
                <span>{league.name}</span>
                <span className={styles.leagueMemberCount}>
                  {league.memberCount > 1 ? `${league.memberCount} membres` : `${league.memberCount} membre`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.notice}>Aucune ligue créée pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
