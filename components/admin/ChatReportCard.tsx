import type { ChatMessageReport } from "@/lib/queries/admin-chat-reports";
import { resolveChatMessageReportFormAction } from "@/lib/actions/chat-reports";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./ChatReportCard.module.css";

// Une carte de la file des signalements de chat (03/09/2026, migration
// 20260903130000) — même patron formulaire natif + redirection que
// BugReportCard.tsx. Différence : le message signalé est affiché en
// citation (snapshot pris au moment du signalement, cf. lib/actions/
// chat-reports.ts) -- reste lisible même si un admin a depuis supprimé le
// message original (messageStillExists = false dans ce cas).

type ChatReportCardProps = {
  report: ChatMessageReport;
  error?: string;
};

export function ChatReportCard({ report, error }: ChatReportCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <p className={styles.player}>
          Signalé par <PlayerLink userId={report.reporterUserId} pseudo={report.reporterPseudo} />
        </p>
        <span className={styles.timestamp}>{report.createdAtLabel}</span>
      </div>

      <div className={styles.quote}>
        <p className={styles.quoteAuthor}>
          {report.messageAuthorId ? (
            <PlayerLink userId={report.messageAuthorId} pseudo={report.messageAuthorPseudo} />
          ) : (
            report.messageAuthorPseudo
          )}
          {!report.messageStillExists && <span className={styles.deletedTag}>déjà supprimé</span>}
        </p>
        <p className={styles.quoteBody}>{report.messageBodySnapshot}</p>
      </div>

      <p className={styles.reason}>{report.reason}</p>

      {report.status === "RESOLVED" ? (
        <p className={styles.resolvedNote}>
          Résolu{report.adminNote ? ` — ${report.adminNote}` : ""}
        </p>
      ) : (
        <form action={resolveChatMessageReportFormAction} className={styles.form}>
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
