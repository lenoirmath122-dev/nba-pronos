import { getPendingPseudoRequests } from "@/lib/queries/pseudo-requests";
import { PseudoRequestCard } from "@/components/admin/PseudoRequestCard";
import styles from "../requests/page.module.css";

// File des demandes de changement de pseudo (migration 20261014090000).
// Composant serveur ; la RLS limite la lecture aux admins.

type SearchParams = { pseudoError?: string; requestId?: string };

export default async function AdminPseudoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const requests = await getPendingPseudoRequests();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Changements de pseudo</h1>

      {requests.length === 0 ? (
        <p className={styles.empty}>Rien à traiter pour le moment.</p>
      ) : (
        <ul className={styles.list}>
          {requests.map((request) => (
            <PseudoRequestCard
              key={request.requestId}
              request={request}
              error={sp.requestId === request.requestId ? sp.pseudoError : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
