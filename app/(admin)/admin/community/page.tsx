import Link from "next/link";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { getVisitorCounts } from "@/lib/queries/admin-visitors";
import styles from "@/components/admin/AdminHub.module.css";

// Rubrique « Joueurs » : total d'inscrits (lien vers la gestion des joueurs)
// et membres par ligue -- RLS admin dédiée, voir lib/queries/admin-dashboard.ts.
// Visiteurs uniques : mesure interne (lib/queries/admin-visitors.ts).

const plural = (n: number) => (n > 1 ? `${n} visiteurs` : `${n} visiteur`);

const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }).format(new Date(iso));

export default async function AdminCommunityPage() {
  const [data, visitors] = await Promise.all([getAdminDashboardData(), getVisitorCounts()]);

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
        <h3 className={styles.sectionTitle}>Visiteurs uniques</h3>
        {visitors ? (
          <>
            <ul className={styles.leagueList}>
              {[
                { label: "Aujourd'hui", count: visitors.today },
                { label: "7 derniers jours", count: visitors.last7Days },
                { label: "30 derniers jours", count: visitors.last30Days },
              ].map(({ label, count }) => (
                <li key={label} className={styles.leagueRow}>
                  <span>{label}</span>
                  <span className={styles.leagueMemberCount}>{plural(count)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.notice}>
              Un visiteur = un navigateur (téléphone et ordinateur comptent pour deux). Tes visites ne comptent pas.
              {visitors.firstVisitAt ? ` Mesuré depuis le ${formatDay(visitors.firstVisitAt)}.` : " Pas encore de visite mesurée."}
            </p>
          </>
        ) : (
          <p className={styles.notice}>Mesure indisponible pour l&apos;instant.</p>
        )}
      </div>

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
