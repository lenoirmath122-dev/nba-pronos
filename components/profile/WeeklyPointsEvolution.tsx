import type { PointsEvolutionData } from "@/lib/queries/pointsEvolution";
import styles from "./WeeklyPointsEvolution.module.css";

// Points gagnés chaque semaine (Stats > Évolution) : une barre par semaine,
// la moyenne de la portée en repère, le rang en fin de semaine. Serveur, sans
// graphe : des barres CSS lisibles à 375 px.
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

function weekLabel(weekStart: string): string {
  return `Sem. du ${DATE_FORMATTER.format(new Date(`${weekStart}T00:00:00Z`))}`;
}

export function WeeklyPointsEvolution({ data }: { data: PointsEvolutionData }) {
  const { rows, scopeName, hasScopeDetails } = data;
  if (rows.length === 0) {
    return <p className={styles.empty}>Pas encore de points à afficher par semaine.</p>;
  }

  const max = Math.max(1, ...rows.map((row) => Math.max(row.points, row.scopeAverage ?? 0)));
  // Les plus récentes en haut.
  const ordered = [...rows].reverse();

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>Points par semaine · {scopeName ?? "Général"}</h3>
      <ul className={styles.list}>
        {ordered.map((row) => (
          <li key={row.weekStart} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.week}>
                {weekLabel(row.weekStart)}
                {row.isCurrent && <span className={styles.current}> · en cours</span>}
              </span>
              <span className={styles.value}>
                {row.points >= 0 ? "+" : ""}
                {row.points} pt{Math.abs(row.points) > 1 ? "s" : ""}
              </span>
            </div>
            <div className={styles.track}>
              <span className={styles.bar} style={{ width: `${(Math.max(row.points, 0) / max) * 100}%` }} />
              {row.scopeAverage !== null && (
                <span
                  className={styles.average}
                  style={{ left: `${(Math.max(row.scopeAverage, 0) / max) * 100}%` }}
                  title={`Moyenne : ${row.scopeAverage} pts`}
                />
              )}
            </div>
            <p className={styles.meta}>
              Total {row.cumulative} pts
              {row.rank !== null && ` · ${row.rank === 1 ? "1er" : `${row.rank}e`}${scopeName ? ` de ${scopeName}` : ""}`}
              {row.scopeAverage !== null && ` · moyenne ${String(row.scopeAverage).replace(".", ",")} pts`}
            </p>
          </li>
        ))}
      </ul>
      {hasScopeDetails && <p className={styles.legend}>Le trait vertical marque la moyenne des joueurs de la portée.</p>}
    </div>
  );
}
