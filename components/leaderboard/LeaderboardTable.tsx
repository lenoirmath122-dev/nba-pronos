import type { LeaderboardRow as RowData, SortKey } from "@/lib/queries/leaderboard";
import { LeaderboardRow } from "./LeaderboardRow";
import styles from "./LeaderboardTable.module.css";

// Tableau du classement (§3/§4) : ordre des colonnes et rang déjà figés par
// lib/queries/leaderboard.ts, ce composant ne fait que rendre l'en-tête et
// déléguer chaque ligne à LeaderboardRow (seule feuille client, expand/repli).
type LeaderboardTableProps = {
  rows: RowData[];
  sortKey: SortKey;
};

function detailColClass(column: SortKey, sortKey: SortKey): string {
  return column === sortKey ? `${styles.colDetail} ${styles.colActive}` : styles.colDetail;
}

export function LeaderboardTable({ rows, sortKey }: LeaderboardTableProps) {
  return (
    <div className={styles.table} role="table" aria-label="Classement">
      <div className={styles.headerRow} role="row">
        <span className={styles.colRank} role="columnheader">
          Rang
        </span>
        <span className={styles.colPlayer} role="columnheader">
          Joueur
        </span>
        <span
          className={sortKey === "total" ? `${styles.colTotal} ${styles.totalBand}` : styles.colTotal}
          role="columnheader"
        >
          Total
        </span>
        <span className={detailColClass("matches", sortKey)} role="columnheader">
          Matchs
        </span>
        <span className={detailColClass("bracket", sortKey)} role="columnheader">
          Bracket
        </span>
        <span className={detailColClass("bets", sortKey)} role="columnheader">
          Paris
        </span>
        <span className={detailColClass("form", sortKey)} role="columnheader">
          Forme
        </span>
      </div>

      <div role="rowgroup">
        {rows.map((row) => (
          <LeaderboardRow key={row.userId} row={row} sortKey={sortKey} />
        ))}
      </div>
    </div>
  );
}
