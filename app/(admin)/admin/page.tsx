import Link from "next/link";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { RecalculateButton } from "@/components/admin/RecalculateButton";
import styles from "./page.module.css";

// Tableau de bord admin (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1, VALIDÉ) : premier
// écran du lot Admin. Composant SERVEUR — seule la RecalculateButton est
// "use client" (§4, dialogue de confirmation). Les cartes « validation »,
// « joueurs » et « logs » sont des <Link> actifs (codés) ; résolution/
// requêtes restent INERTES « à venir » tant que leur page n'existe pas
// (T5 lot 4/4 les débloque progressivement), même patron que le hub Jouer
// temporaire (ETAT_ACTUEL.md §2.10).

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
          <Link href="/admin/logs" className={styles.linkEntryActive}>
            Historique des logs
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
      </ul>

      <RecalculateButton disabled={!data.competitionId} />
    </div>
  );
}
