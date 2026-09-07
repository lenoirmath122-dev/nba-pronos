import Link from "next/link";
import { getSyncLogs, getLatestHighlightlyQuota, SYNC_TYPE_LABELS } from "@/lib/queries/admin-sync-logs";
import { SyncLogRow } from "@/components/admin/SyncLogRow";
import { LOW_QUOTA_THRESHOLD } from "@/lib/sync/logging";
import { getTodaySpendUsd, DAILY_COST_CAP_USD } from "@/lib/ai/usageTracking";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import styles from "./page.module.css";

// Logs de synchronisation (p1-6, feuille de route Phase 1) : sync_logs est
// écrit par les 4 routes /api/sync/* (+ le heartbeat) depuis B3, mais
// jamais affiché nulle part jusqu'ici -- premier écran, même minimal.
// Consultation PURE, aucune écriture, même patron que /admin/logs
// (audit_logs) : filtres en <form method="get"> natif, aucun "use client".

type SearchParams = { type?: string; failed?: string };

export default async function AdminSyncLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = { syncType: sp.type, failedOnly: sp.failed === "1" };

  const [logs, quota, aiSpendUsd] = await Promise.all([getSyncLogs(filters), getLatestHighlightlyQuota(), getTodaySpendUsd()]);
  const hasActiveFilters = Boolean(sp.type || sp.failed);
  const quotaLow = quota !== null && quota.requestsRemaining <= LOW_QUOTA_THRESHOLD;
  const aiSpendHigh = aiSpendUsd >= DAILY_COST_CAP_USD;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Logs de synchronisation</h1>
      <p className={styles.intro}>100 derniers événements des routes /api/sync/* et du heartbeat.</p>

      {quota && (
        <p className={quotaLow ? styles.quotaBannerLow : styles.quotaBanner}>
          {quotaLow && "⚠️ "}Quota Highlightly : {quota.requestsRemaining} requête(s) restante(s) (lu {parisDateTimeLabel(quota.createdAt)})
        </p>
      )}
      <p className={aiSpendHigh ? styles.quotaBannerLow : styles.quotaBanner}>
        {aiSpendHigh && "⚠️ "}Dépense IA (structuration de paris) aujourd&apos;hui : {aiSpendUsd.toFixed(2)}$ / {DAILY_COST_CAP_USD}$
      </p>

      <form method="get" className={styles.filters}>
        <label className={styles.field}>
          Type
          <select name="type" defaultValue={sp.type ?? ""} className={styles.select}>
            <option value="">Tous</option>
            {Object.entries(SYNC_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.checkboxField}>
          <input type="checkbox" name="failed" value="1" defaultChecked={sp.failed === "1"} />
          Échecs uniquement
        </label>

        <button type="submit" className={styles.submit}>
          Filtrer
        </button>
        {hasActiveFilters && (
          <Link href="/admin/sync-logs" className={styles.reset}>
            Réinitialiser
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <p className={styles.empty}>
          {hasActiveFilters ? "Aucun résultat pour ces filtres." : "Aucune synchronisation journalisée pour l'instant."}
        </p>
      ) : (
        <ul className={styles.list}>
          {logs.map((log) => (
            <SyncLogRow key={log.id} log={log} />
          ))}
        </ul>
      )}
    </div>
  );
}
