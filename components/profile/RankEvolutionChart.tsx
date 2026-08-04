import type { ProfileStatsEvolutionPoint } from "@/lib/queries/stats";
import styles from "./RankEvolutionChart.module.css";

// Courbe d'évolution du rang (onglet Stats, Profil, 04/08/2026) — SVG à la
// main, composant SERVEUR (aucune interactivité en v1), pas de librairie de
// graphes (aucune dans le projet, une seule ligne ne le justifie pas).
//
// Rang 1 = meilleur = doit apparaître EN HAUT de l'écran. Comme le rang
// grandit vers le bas ET que l'axe y SVG grandit aussi vers le bas, projeter
// le rang DIRECTEMENT sur y donne déjà le bon sens — aucune inversion à
// coder, seulement une mise à l'échelle du domaine.
//
// Toujours en classement GÉNÉRAL (leaderboard_snapshots.rank), même si un
// filtre ligue est actif sur la section Comparaison plus haut dans l'écran —
// recalculer un rang par ligue jour par jour demanderait de ré-agréger tous
// les snapshots de tous les joueurs, hors de proportion pour ce lot (voir le
// plan). Précisé dans la légende sous le graphe.

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 140;
const PLOT_X_MIN = 28;
const PLOT_X_MAX = 308;
const PLOT_Y_MIN = 12;
const PLOT_Y_MAX = 116;
const AXIS_LABEL_Y = 132;

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit" });

function formatDate(iso: string): string {
  return DATE_FORMATTER.format(new Date(iso));
}

type RankEvolutionChartProps = { series: ProfileStatsEvolutionPoint[] };

export function RankEvolutionChart({ series }: RankEvolutionChartProps) {
  const ranks = series.map((point) => point.rank);
  const rankMin = Math.min(...ranks);
  const rankMax = Math.max(...ranks);
  const domainMin = Math.max(1, rankMin - 1);
  const domainMax = rankMax + 1;

  function xOf(index: number): number {
    return PLOT_X_MIN + (index / (series.length - 1)) * (PLOT_X_MAX - PLOT_X_MIN);
  }
  function yOf(rank: number): number {
    return PLOT_Y_MIN + ((rank - domainMin) / (domainMax - domainMin)) * (PLOT_Y_MAX - PLOT_Y_MIN);
  }

  const points = series.map((point, index) => ({ x: xOf(index), y: yOf(point.rank) }));
  const pathD = points.map((p) => `${p.x},${p.y}`).join(" L ");

  const first = series[0];
  const last = series[series.length - 1];
  const lastPoint = points[points.length - 1];
  const labelY = Math.max(10, lastPoint.y - 10);

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      role="img"
      aria-label={`Évolution du classement : rang ${first.rank} le ${formatDate(first.date)}, rang ${last.rank} le ${formatDate(last.date)}`}
    >
      <path d={`M ${pathD}`} fill="none" className={styles.line} />
      {points.map((point, index) => (
        <circle key={series[index].date} cx={point.x} cy={point.y} r={index === points.length - 1 ? 3.5 : 2.5} className={styles.dot} />
      ))}
      <text x={lastPoint.x} y={labelY} textAnchor="end" className={styles.rankLabel}>
        #{last.rank}
      </text>
      <text x={PLOT_X_MIN} y={AXIS_LABEL_Y} textAnchor="start" className={styles.axisLabel}>
        {formatDate(first.date)}
      </text>
      <text x={PLOT_X_MAX} y={AXIS_LABEL_Y} textAnchor="end" className={styles.axisLabel}>
        {formatDate(last.date)}
      </text>
    </svg>
  );
}
