import Link from "next/link";
import { getAdminResultsData } from "@/lib/queries/admin-results";
import { SeriesResultsCard } from "@/components/admin/SeriesResultsCard";
import styles from "./page.module.css";

// Saisie des résultats (SPEC_ECRAN_ADMIN_RESULTATS_V0_1, VALIDÉ) — lot 2/3
// du chantier « Gestion des compétitions ». Composant serveur, aucun
// "use client" : tout est formulaire natif (même patron que
// /admin/resolution, /admin/requests).

type SearchParams = { resultsError?: string; matchId?: string; seriesId?: string };

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const data = await getAdminResultsData();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Saisie des résultats</h1>

      {data.competitionId === null ? (
        <>
          <p className={styles.empty}>Aucune compétition en cours.</p>
          <Link href="/admin/competitions" className={styles.backLink}>
            Retour à Compétitions
          </Link>
        </>
      ) : data.rounds.length === 0 ? (
        <p className={styles.empty}>Aucune série pour l&rsquo;instant.</p>
      ) : (
        data.rounds.map((round) => (
          <section key={round.key} className={styles.round}>
            <h2 className={styles.roundLabel}>{round.label}</h2>
            <div className={styles.seriesList}>
              {round.nodes.map((node) => (
                <SeriesResultsCard
                  key={node.id}
                  node={node}
                  errorMatchId={sp.matchId}
                  errorSeriesId={sp.seriesId}
                  errorMessage={sp.resultsError}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
