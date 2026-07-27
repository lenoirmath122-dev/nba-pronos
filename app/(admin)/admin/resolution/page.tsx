import { getPendingResolutionBets } from "@/lib/queries/admin-resolution";
import { ResolutionBetCard } from "@/components/admin/ResolutionBetCard";
import styles from "./page.module.css";

// File de résolution admin (SPEC_ECRAN_ADMIN_RESOLUTION_V0_1, VALIDÉ) —
// lot 4b du câblage admin. Composant serveur, aucun "use client".

type SearchParams = { resolutionError?: string; betId?: string };

export default async function AdminResolutionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const bets = await getPendingResolutionBets();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Résolution des paris</h1>

      {bets.length === 0 ? (
        <p className={styles.empty}>Rien à résoudre pour le moment.</p>
      ) : (
        <ul className={styles.list}>
          {bets.map((bet) => (
            <ResolutionBetCard
              key={bet.betId}
              bet={bet}
              error={sp.betId === bet.betId ? sp.resolutionError : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
