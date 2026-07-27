import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import styles from "./page.module.css";

// Tableau de bord admin (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1, VALIDÉ) : premier
// écran du lot Admin. Composant 100% SERVEUR — pas de bouton Recalculer
// dans ce lot (recomputeCompetition, T5, n'existe pas encore en base, voir
// l'en-tête de la spec), pas de <Link> actif vers les 5 pages filles
// (aucune n'existe encore) — entrées INERTES « à venir », même patron que
// le hub Jouer temporaire (ETAT_ACTUEL.md §2.10). Chaque entrée devient un
// <Link> au fur et à mesure que sa page fille est codée (GAPS_OUVERTS.md).

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  const queues = [
    {
      key: "validation",
      count: data.pendingValidationCount,
      label: (n: number) => (n > 1 ? "paris à valider" : "pari à valider"),
    },
    {
      key: "resolution",
      count: data.pendingResolutionCount,
      label: (n: number) => (n > 1 ? "paris à résoudre" : "pari à résoudre"),
    },
    {
      key: "requests",
      count: data.pendingRequestsCount,
      label: (n: number) => (n > 1 ? "requêtes en attente" : "requête en attente"),
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
        {queues.map((queue) => (
          <li key={queue.key}>
            <div className={styles.card}>
              <span className={styles.count}>{queue.count}</span>
              <span className={styles.cardLabel}>{queue.label(queue.count)}</span>
              <span className={styles.inertTag}>à venir</span>
            </div>
          </li>
        ))}
      </ul>

      <ul className={styles.linkList}>
        <li>
          <div className={styles.linkEntry}>
            Gestion des joueurs
            <span className={styles.inertTag}>à venir</span>
          </div>
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
