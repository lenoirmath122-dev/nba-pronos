import Link from "next/link";
import { getPendingCorrectionRequests } from "@/lib/queries/admin-requests";
import { RequestCard } from "@/components/admin/RequestCard";
import styles from "./page.module.css";

// File des requêtes (SPEC_ECRAN_ADMIN_REQUESTS_V0_1, VALIDÉ) — lot 4c,
// DERNIER morceau du câblage admin (T5). Composant serveur, aucun
// "use client".

type SearchParams = { requestsError?: string; requestId?: string; page?: string };

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { requests, hasMore } = await getPendingCorrectionRequests(page);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Requêtes de correction</h1>

      {requests.length === 0 ? (
        <p className={styles.empty}>Rien à traiter pour le moment.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {requests.map((request) => (
              <RequestCard
                key={request.requestId}
                request={request}
                error={sp.requestId === request.requestId ? sp.requestsError : undefined}
              />
            ))}
          </ul>

          {(page > 1 || hasMore) && (
            <nav className={styles.pagination} aria-label="Pagination des requêtes">
              {page > 1 ? (
                <Link href={page > 2 ? `/admin/requests?page=${page - 1}` : "/admin/requests"} className={styles.pageLink}>
                  ← Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className={styles.pageNum}>Page {page}</span>
              {hasMore ? (
                <Link href={`/admin/requests?page=${page + 1}`} className={styles.pageLink}>
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
