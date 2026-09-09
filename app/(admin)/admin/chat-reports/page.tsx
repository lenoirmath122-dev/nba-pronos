import Link from "next/link";
import { getChatMessageReports } from "@/lib/queries/admin-chat-reports";
import { ChatReportCard } from "@/components/admin/ChatReportCard";
import styles from "./page.module.css";

// File des signalements de chat (03/09/2026, migration 20260903130000,
// cadrage juridique §2.10 point 7) — même patron que /admin/bug-reports :
// composant serveur, `statut` bascule OPEN/RESOLVED (repli OPEN).

type SearchParams = { statut?: string; reportId?: string; chatReportError?: string; page?: string };

export default async function AdminChatReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const status = sp.statut === "resolved" ? "RESOLVED" : "OPEN";
  const page = Math.max(1, Number(sp.page) || 1);
  const { reports, hasMore } = await getChatMessageReports(status, page);

  const pageLink = (targetPage: number) => {
    const params = new URLSearchParams();
    if (status === "RESOLVED") params.set("statut", "resolved");
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/chat-reports?${qs}` : "/admin/chat-reports";
  };

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
        <>
          <ul className={styles.list}>
            {reports.map((report) => (
              <ChatReportCard
                key={report.reportId}
                report={report}
                error={sp.reportId === report.reportId ? sp.chatReportError : undefined}
              />
            ))}
          </ul>

          {(page > 1 || hasMore) && (
            <nav className={styles.pagination} aria-label="Pagination des signalements">
              {page > 1 ? (
                <Link href={pageLink(page - 1)} className={styles.pageLink}>
                  ← Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className={styles.pageNum}>Page {page}</span>
              {hasMore ? (
                <Link href={pageLink(page + 1)} className={styles.pageLink}>
                  Suivant →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
