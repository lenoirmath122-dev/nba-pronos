import { getResolutionQueues } from "@/lib/queries/admin-resolution";
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
  const { due, orphan } = await getResolutionQueues();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Résolution des paris</h1>

      {due.length === 0 ? (
        <p className={styles.empty}>Rien à résoudre pour le moment.</p>
      ) : (
        <ul className={styles.list}>
          {due.map((bet) => (
            <ResolutionBetCard
              key={bet.betId}
              bet={bet}
              error={sp.betId === bet.betId ? sp.resolutionError : undefined}
            />
          ))}
        </ul>
      )}

      {/* Paris sans échéance connue (p1-15, feuille de route Phase 1) --
          jamais dans la liste ci-dessus (filtrée sur échéance PASSÉE), donc
          jamais visibles nulle part sans cette section. Signale une synchro
          calendrier potentiellement en défaut sur ce match/cette série,
          plutôt que de laisser le pari indéfiniment ouvert en silence. */}
      {orphan.length > 0 && (
        <>
          <h2 className={styles.title}>Sans échéance connue — vérifier la synchro</h2>
          <p className={styles.empty}>
            Aucun match synchronisé pour ces paris : leur échéance ne peut pas être calculée, ils restent
            ouverts tant qu&apos;aucune date n&apos;est connue. À investiguer (calendrier absent ou synchro en défaut).
          </p>
          <ul className={styles.list}>
            {orphan.map((bet) => (
              <ResolutionBetCard
                key={bet.betId}
                bet={bet}
                error={sp.betId === bet.betId ? sp.resolutionError : undefined}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
