import { PlayerLink } from "@/components/ui/PlayerLink";
import type { getCompetitionHistory } from "@/lib/queries/history";
import styles from "./profileShared.module.css";

function formatArchivedDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso)
  );
}

export function HistorySection({ history }: { history: Awaited<ReturnType<typeof getCompetitionHistory>> }) {
  return (
    <section className={`${styles.section} glass-card`}>
      {history.length === 0 ? (
        <p className={styles.fieldLabel}>Aucune compétition archivée pour l&apos;instant.</p>
      ) : (
        <div className={styles.historyList}>
          {history.map((entry) => (
            <div key={entry.competitionId} className={styles.historyRow}>
              <div className={styles.historyHeader}>
                <span className={styles.leagueName}>{entry.name}</span>
                {entry.archivedAt && <span className={styles.leagueMeta}>{formatArchivedDate(entry.archivedAt)}</span>}
              </div>
              {entry.superlatives.length > 0 && (
                <ul className={styles.superlativeList}>
                  {entry.superlatives.map((s, i) => (
                    <li key={`${s.kind}-${i}`} className={styles.superlativeItem}>
                      <span className={styles.superlativeLabel}>{s.label}</span> —{" "}
                      <PlayerLink userId={s.userId} pseudo={s.pseudo} /> ({s.value})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
