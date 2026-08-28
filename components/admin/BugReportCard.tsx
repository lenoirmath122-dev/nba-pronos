import type { BugReport } from "@/lib/queries/admin-bug-reports";
import { resolveBugReportFormAction } from "@/lib/actions/bug-reports";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./BugReportCard.module.css";

// Une carte de la file des signalements (28/08/2026, migration #33) — même
// patron formulaire natif + redirection que RequestCard.tsx, en bien plus
// simple : un seul geste possible (marquer résolu), pas de champs à choisir.

type BugReportCardProps = {
  report: BugReport;
  error?: string;
};

export function BugReportCard({ report, error }: BugReportCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <p className={styles.player}>
          <PlayerLink userId={report.reporterUserId} pseudo={report.reporterPseudo} />
        </p>
        <span className={styles.timestamp}>{report.createdAtLabel}</span>
      </div>
      {report.screenPath && <p className={styles.screen}>{report.screenPath}</p>}
      <p className={styles.description}>{report.description}</p>

      {report.status === "RESOLVED" ? (
        <p className={styles.resolvedNote}>
          Résolu{report.adminNote ? ` — ${report.adminNote}` : ""}
        </p>
      ) : (
        <form action={resolveBugReportFormAction} className={styles.form}>
          <input type="hidden" name="reportId" value={report.reportId} />
          {error && <p className={styles.error}>{error}</p>}
          <label className={styles.field}>
            Note (optionnelle)
            <textarea name="adminNote" rows={2} className={styles.textarea} />
          </label>
          <button type="submit" className={styles.resolveButton}>
            Marquer résolu
          </button>
        </form>
      )}
    </li>
  );
}
