import styles from "./BaremeTable.module.css";

// Implémenté en divs+flex avec rôles ARIA (convention du dépôt, pas de
// <table> — même patron que LeaderboardTable.tsx), réutilisé pour les 2
// barèmes à plusieurs colonnes de la page Règles (bracket).
type BaremeTableProps = {
  caption: string;
  columns: string[];
  rows: { label: string; values: string[] }[];
};

export function BaremeTable({ caption, columns, rows }: BaremeTableProps) {
  return (
    <div className={styles.table} role="table" aria-label={caption}>
      <div className={styles.headerRow} role="row">
        <span className={styles.colLabel} role="columnheader" />
        {columns.map((col) => (
          <span key={col} className={styles.colValue} role="columnheader">
            {col}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.label} className={styles.row} role="row">
          <span className={styles.colLabel} role="rowheader">
            {row.label}
          </span>
          {row.values.map((value, i) => (
            <span key={columns[i]} className={styles.colValue} role="cell">
              {value}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
