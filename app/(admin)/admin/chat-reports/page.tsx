import Link from "next/link";
import { getChatMessageReports } from "@/lib/queries/admin-chat-reports";
import { ChatReportCard } from "@/components/admin/ChatReportCard";
import styles from "./page.module.css";

// File des signalements de chat (03/09/2026, migration 20260903130000,
// cadrage juridique §2.10 point 7) — même patron que /admin/bug-reports :
// composant serveur, `statut` bascule OPEN/RESOLVED (repli OPEN).

type SearchParams = { statut?: string; reportId?: string; chatReportError?: string };

export default async function AdminChatReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = sp.statut === "resolved" ? "RESOLVED" : "OPEN";
  const reports = await getChatMessageReports(status);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Signalements de chat</h1>

      <div className={styles.tabs}>
        <Link href="/admin/chat-reports" className={status === "OPEN" ? styles.tabActive : styles.tab}>
          Ouverts
        </Link>
        <Link href="/admin/chat-reports?statut=resolved" className={status === "RESOLVED" ? styles.tabActive : styles.tab}>
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
            <ChatReportCard
              key={report.reportId}
              report={report}
              error={sp.reportId === report.reportId ? sp.chatReportError : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
