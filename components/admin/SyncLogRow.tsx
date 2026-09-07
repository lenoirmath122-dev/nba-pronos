import type { SyncLogRow as SyncLogRowData } from "@/lib/queries/admin-sync-logs";
import { SYNC_TYPE_LABELS } from "@/lib/queries/admin-sync-logs";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import styles from "./SyncLogRow.module.css";

// Une ligne de l'écran "Logs de synchronisation" (p1-6) -- consultation
// PURE, aucune action. Réussi/Échec porté par le TEXTE, pas seulement une
// couleur (même principe que R-COL7 pour la tendance de forme : jamais un
// signal uniquement colorimétrique).

export function SyncLogRow({ log }: { log: SyncLogRowData }) {
  return (
    <li className={styles.row}>
      <div className={styles.header}>
        <span className={styles.timestamp}>{parisDateTimeLabel(log.createdAt)}</span>
        <span className={styles.type}>{SYNC_TYPE_LABELS[log.syncType] ?? log.syncType}</span>
        <span className={log.success ? styles.success : styles.failure}>
          {log.success ? "✓ Réussi" : "✗ Échec"}
        </span>
        {log.requestsRemaining !== null && (
          <span className={styles.quota}>{log.requestsRemaining} requête(s) restante(s)</span>
        )}
      </div>

      {log.summary && <p className={styles.summary}>{log.summary}</p>}
    </li>
  );
}
