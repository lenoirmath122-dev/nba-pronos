import type { AuditLogRow as AuditLogRowData } from "@/lib/queries/admin-logs";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import styles from "./AuditLogRow.module.css";

// Une ligne de l'Historique des logs (SPEC_ECRAN_ADMIN_LOGS_V0_1 §2) —
// consultation PURE, aucune action, aucun formulaire.

function targetLabel(log: AuditLogRowData): string {
  if (log.targetPseudo) return `${log.targetType} · ${log.targetPseudo}`;
  return log.targetId ? `${log.targetType} · ${log.targetId.slice(0, 8)}` : log.targetType;
}

export function AuditLogRow({ log }: { log: AuditLogRowData }) {
  return (
    <li className={styles.row}>
      <div className={styles.header}>
        <span className={styles.timestamp}>{parisDateTimeLabel(log.createdAt)}</span>
        <span className={styles.actor}>
          {log.actorUserId ? <PlayerLink userId={log.actorUserId} pseudo={log.actorPseudo} /> : log.actorPseudo}
        </span>
        <span className={styles.action}>{log.actionLabel}</span>
        <span className={styles.target}>{targetLabel(log)}</span>
      </div>

      {log.reason && <p className={styles.reason}>Motif : {log.reason}</p>}

      {(log.beforeValue !== null || log.afterValue !== null) && (
        <div className={styles.diff}>
          {log.beforeValue !== null && (
            <pre className={styles.pre}>avant : {JSON.stringify(log.beforeValue)}</pre>
          )}
          {log.afterValue !== null && (
            <pre className={styles.pre}>après : {JSON.stringify(log.afterValue)}</pre>
          )}
        </div>
      )}
    </li>
  );
}
