import Link from "next/link";
import { getAuditLogs, getAuditLogFilterOptions } from "@/lib/queries/admin-logs";
import { AuditLogRow } from "@/components/admin/AuditLogRow";
import styles from "./page.module.css";

// Historique des logs (SPEC_ECRAN_ADMIN_LOGS_V0_1, VALIDÉ) — quatrième
// écran du lot Admin. Consultation PURE, aucune écriture. Filtres en
// <form method="get"> natif (querystring), aucun "use client".

type SearchParams = { action?: string; admin?: string; date?: string };

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = { action: sp.action, actorUserId: sp.admin, date: sp.date };

  const [logs, options] = await Promise.all([getAuditLogs(filters), getAuditLogFilterOptions()]);
  const hasActiveFilters = Boolean(sp.action || sp.admin || sp.date);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Historique des logs</h1>

      <form method="get" className={styles.filters}>
        <label className={styles.field}>
          Action
          <select name="action" defaultValue={sp.action ?? ""} className={styles.select}>
            <option value="">Toutes</option>
            {options.actions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          Admin
          <select name="admin" defaultValue={sp.admin ?? ""} className={styles.select}>
            <option value="">Tous</option>
            {options.actors.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          Date
          <input type="date" name="date" defaultValue={sp.date ?? ""} className={styles.select} />
        </label>

        <button type="submit" className={styles.submit}>
          Filtrer
        </button>
        {hasActiveFilters && (
          <Link href="/admin/logs" className={styles.reset}>
            Réinitialiser
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <p className={styles.empty}>
          {hasActiveFilters ? "Aucun résultat pour ces filtres." : "Aucune action journalisée pour l'instant."}
        </p>
      ) : (
        <ul className={styles.list}>
          {logs.map((log) => (
            <AuditLogRow key={log.id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}
