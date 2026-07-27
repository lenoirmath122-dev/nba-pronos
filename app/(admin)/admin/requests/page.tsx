import { getPendingCorrectionRequests } from "@/lib/queries/admin-requests";
import { RequestCard } from "@/components/admin/RequestCard";
import styles from "./page.module.css";

// File des requêtes (SPEC_ECRAN_ADMIN_REQUESTS_V0_1, VALIDÉ) — lot 4c,
// DERNIER morceau du câblage admin (T5). Composant serveur, aucun
// "use client".

type SearchParams = { requestsError?: string; requestId?: string };

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const requests = await getPendingCorrectionRequests();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Requêtes de correction</h1>

      {requests.length === 0 ? (
        <p className={styles.empty}>Rien à traiter pour le moment.</p>
      ) : (
        <ul className={styles.list}>
          {requests.map((request) => (
            <RequestCard
              key={request.requestId}
              request={request}
              error={sp.requestId === request.requestId ? sp.requestsError : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
