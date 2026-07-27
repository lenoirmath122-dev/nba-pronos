import Link from "next/link";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import styles from "./page.module.css";

// Tableau de bord admin (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1, VALIDÉ) : premier
// écran du lot Admin. Composant 100% SERVEUR — pas de bouton Recalculer
// dans ce lot (recomputeCompetition, T5, n'existe pas encore en base, voir
// l'en-tête de la spec). Les cartes « validation » et « joueurs » sont
// désormais des <Link> actifs (codés) ; résolution/requêtes/logs restent
// INERTES « à venir » tant que leur page n'existe pas, même patron que le
// hub Jouer temporaire (ETAT_ACTUEL.md §2.10) — retirées une à une au fur
// et à mesure (GAPS_OUVERTS.md).

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  const queues = [
    {
      key: "validation",
      count: data.pendingValidationCount,
      label: (n: number) => (n > 1 ? "paris à valider" : "pari à valider"),
      href: "/admin/validation",
    },
    {
      key: "resolution",
      count: data.pendingResolutionCount,
      label: (n: number) => (n > 1 ? "paris à résoudre" : "pari à résoudre"),
      href: null,
    },
    {
      key: "requests",
      count: data.pendingRequestsCount,
      label: (n: number) => (n > 1 ? "requêtes en attente" : "requête en attente"),
      href: null,
    },
  ] as const;

  return (
    <div className={styles.page}>
      {!data.competitionId && (
        <p className={styles.notice}>
          Aucune compétition en cours. La prochaine arrive bientôt.
        </p>
      )}

      <ul className={styles.cardList}>
        {queues.map((queue) =>
          queue.href ? (
            <li key={queue.key}>
              <Link href={queue.href} className={styles.cardLink}>
                <span className={styles.count}>{queue.count}</span>
                <span className={styles.cardLabel}>{queue.label(queue.count)}</span>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </Link>
            </li>
          ) : (
            <li key={queue.key}>
              <div className={styles.card}>
                <span className={styles.count}>{queue.count}</span>
                <span className={styles.cardLabel}>{queue.label(queue.count)}</span>
                <span className={styles.inertTag}>à venir</span>
              </div>
            </li>
          )
        )}
      </ul>

      <ul className={styles.linkList}>
        <li>
          <Link href="/admin/players" className={styles.linkEntryActive}>
            Gestion des joueurs
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <div className={styles.linkEntry}>
            Historique des logs
            <span className={styles.inertTag}>à venir</span>
          </div>
        </li>
      </ul>

      <p className={styles.footnote}>
        Bouton « Recalculer » : ajouté quand le moteur de scoring sera codé.
      </p>
    </div>
  );
}
