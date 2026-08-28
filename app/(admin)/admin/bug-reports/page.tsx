import Link from "next/link";
import { getBugReports } from "@/lib/queries/admin-bug-reports";
import { BugReportCard } from "@/components/admin/BugReportCard";
import styles from "./page.module.css";

// File des signalements (28/08/2026, migration #33) — même patron que
// /admin/requests : composant serveur, aucun "use client". `statut` bascule
// OPEN/RESOLVED (repli OPEN, l'écran d'arrivée pour traiter la file).

type SearchParams = { statut?: string; reportId?: string; bugReportError?: string };

export default async function AdminBugReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = sp.statut === "resolved" ? "RESOLVED" : "OPEN";
  const reports = await getBugReports(status);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Signalements</h1>

      <div className={styles.tabs}>
        <Link href="/admin/bug-reports" className={status === "OPEN" ? styles.tabActive : styles.tab}>
          Ouverts
        </Link>
        <Link href="/admin/bug-reports?statut=resolved" className={status === "RESOLVED" ? styles.tabActive : styles.tab}>
          Résolus
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className={styles.empty}>
          {status === "OPEN" ? "Rien à traiter pour le moment." : "Aucun signalement résolu pour le moment."}
        </p>
      ) : (
        <ul className={styles.list}>
          {reports.map((report) => (
            <BugReportCard
              key={report.reportId}
              report={report}
              error={sp.reportId === report.reportId ? sp.bugReportError : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
