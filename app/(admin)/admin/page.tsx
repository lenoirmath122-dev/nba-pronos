import Link from "next/link";
import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { RecalculateButton } from "@/components/admin/RecalculateButton";
import styles from "./page.module.css";

// Tableau de bord admin (SPEC_ECRAN_ADMIN_DASHBOARD_V0_1, VALIDÉ) : premier
// écran du lot Admin. Composant SERVEUR — seule la RecalculateButton est
// "use client" (§4, dialogue de confirmation). Le lot Admin ET le chantier
// T5 sont entièrement clos ; « Compétitions » (SPEC_ECRAN_ADMIN_
// COMPETITIONS_V0_1, chantier séparé et postérieur) ajouté en lien simple.

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
      href: "/admin/resolution",
    },
    {
      key: "requests",
      count: data.pendingRequestsCount,
      label: (n: number) => (n > 1 ? "requêtes en attente" : "requête en attente"),
      href: "/admin/requests",
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
            <Link href={queue.href} className={styles.cardLink}>
              <span className={styles.count}>{queue.count}</span>
              <span className={styles.cardLabel}>{queue.label(queue.count)}</span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <ul className={styles.linkList}>
        <li>
          <Link href="/admin/competitions" className={styles.linkEntryActive}>
            Compétitions
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
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
        <li>
          <Link href="/admin/missing" className={styles.linkEntryActive}>
            Qui manque à l&apos;appel
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/admin/bug-reports" className={styles.linkEntryActive}>
            Signalements
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </Link>
        </li>
        <li>
          <Link href="/admin/chat-reports" className={styles.linkEntryActive}>
            Signalements de chat
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
