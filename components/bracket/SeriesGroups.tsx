import type { SeriesPickGroup } from "@/lib/queries/bracket";
import styles from "./SeriesGroups.module.css";

// Contenu du drill-down (§11) : groupé par pronostic, trié par effectif
// décroissant (déjà fait par lib/queries/bracket.ts), rendu ici sans
// interactivité propre.
type SeriesGroupsProps = {
  groups: SeriesPickGroup[];
};

// "4-2" (format série_format : victoires-défaites du vainqueur) → "en 6"
// (nombre total de matchs de la série), lecture du même vocabulaire que le
// drill-down de la spec (§11 : « Celtics en 6 »).
function formatSeriesLength(format: string): string {
  const [wins, losses] = format.split("-").map(Number);
  return `en ${wins + losses}`;
}

export function SeriesGroups({ groups }: SeriesGroupsProps) {
  if (groups.length === 0) {
    // Série sans bracket rempli (§11/§16) — état inline, pas un état vide de page.
    return <p className={styles.empty}>Aucun bracket rempli sur cette série</p>;
  }

  const maxCount = Math.max(...groups.map((group) => group.count));

  return (
    <div className={styles.list}>
      {groups.map((group) => (
        <div key={`${group.teamAbbreviation}-${group.seriesFormat ?? "sec"}`} className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={styles.pick}>
              {group.teamAbbreviation}
              {group.seriesFormat ? ` ${formatSeriesLength(group.seriesFormat)}` : ""}
            </span>
            <span className={styles.bar} aria-hidden="true">
              <span
                className={styles.barFill}
                style={{ width: `${Math.round((group.count / maxCount) * 100)}%` }}
              />
            </span>
            <span className={styles.count}>
              {group.percentage !== null
                ? `${group.percentage} %`
                : `${group.count} joueur${group.count > 1 ? "s" : ""}`}
            </span>
          </div>
          <p className={styles.players}>{group.players.join(" · ")}</p>
        </div>
      ))}
    </div>
  );
}
