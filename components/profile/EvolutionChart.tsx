"use client";

import { useState } from "react";
import type { PointsEvolutionData } from "@/lib/queries/pointsEvolution";
import styles from "./EvolutionChart.module.css";

// Évolution du joueur (Stats > Évolution) : UN graphique, trois mesures au
// choix (points par semaine, total cumulé, classement). La portée (général ou
// ligue) reste un paramètre d'URL géré par LeagueScopeChips ; ici le filtre
// de mesure est local. SVG à la main, comme le reste du projet.
type Metric = "points" | "cumulative" | "rank";

const METRICS: { id: Metric; label: string }[] = [
  { id: "points", label: "Points par semaine" },
  { id: "cumulative", label: "Total cumulé" },
  { id: "rank", label: "Classement" },
];

const W = 320;
const H = 160;
const X0 = 28;
const X1 = 308;
const Y0 = 14;
const Y1 = 128;

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

function shortDate(weekStart: string): string {
  return DATE_FORMATTER.format(new Date(`${weekStart}T00:00:00Z`));
}

export function EvolutionChart({ data }: { data: PointsEvolutionData }) {
  const { rows, scopeName, hasScopeDetails } = data;
  const [metric, setMetric] = useState<Metric>("points");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (rows.length === 0) {
    return <p className={styles.empty}>Pas encore de points à afficher.</p>;
  }

  const rankAvailable = hasScopeDetails && rows.some((row) => row.rank !== null);
  const current = metric === "rank" && !rankAvailable ? "points" : metric;

  const values = rows.map((row) => {
    if (current === "points") return row.points;
    if (current === "cumulative") return row.cumulative;
    return row.rank;
  });
  const numeric = values.filter((v): v is number => v !== null);
  const averages = current === "points" ? rows.map((row) => row.scopeAverage) : [];

  const hi = Math.max(1, ...numeric, ...averages.filter((v): v is number => v !== null));
  const lo = current === "points" ? 0 : Math.min(...numeric);
  // Le rang 1 doit être en haut : l'axe y SVG descend, le rang aussi.
  const span = Math.max(1, hi - lo);
  const n = rows.length;
  const xOf = (i: number) => (n === 1 ? (X0 + X1) / 2 : X0 + (i / (n - 1)) * (X1 - X0));
  const yOf = (v: number) =>
    current === "rank" ? Y0 + ((v - lo) / span) * (Y1 - Y0) : Y1 - ((v - lo) / span) * (Y1 - Y0);

  const shown = activeIndex ?? n - 1;
  const row = rows[shown];
  const readout = (() => {
    const v = values[shown];
    if (v === null) return "—";
    if (current === "rank") return v === 1 ? "1er" : `${v}e`;
    if (current === "points") return `${v >= 0 ? "+" : ""}${v} pt${Math.abs(v) > 1 ? "s" : ""}`;
    return `${v} pts`;
  })();

  const linePoints = values
    .map((v, i) => (v === null ? null : { x: xOf(i), y: yOf(v), i }))
    .filter((p): p is { x: number; y: number; i: number } => p !== null);
  const barWidth = Math.min(28, ((X1 - X0) / n) * 0.6);

  return (
    <div className={styles.wrapper}>
      <div className={styles.group} role="group" aria-label="Mesure affichée">
        {METRICS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={styles.chip}
            aria-pressed={current === id}
            disabled={id === "rank" && !rankAvailable}
            onClick={() => {
              setMetric(id);
              setActiveIndex(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <p className={styles.readout} aria-live="polite">
        <span className={styles.readoutValue}>{readout}</span>
        <span className={styles.readoutMeta}>
          Sem. du {shortDate(row.weekStart)}
          {row.isCurrent ? " · en cours" : ""} · {scopeName ?? "Général"}
        </span>
      </p>

      <div className={styles.chartBox}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${METRICS.find((m) => m.id === current)?.label}, ${scopeName ?? "général"}, du ${shortDate(rows[0].weekStart)} au ${shortDate(rows[n - 1].weekStart)}`}
        >
          {current === "points" ? (
            <>
              {rows.map((r, i) => (
                <rect
                  key={r.weekStart}
                  x={xOf(i) - barWidth / 2}
                  y={yOf(Math.max(r.points, 0))}
                  width={barWidth}
                  height={Math.max(1, Y1 - yOf(Math.max(r.points, 0)))}
                  rx={2}
                  className={i === shown ? styles.barActive : styles.bar}
                />
              ))}
              {rows.map((r, i) =>
                r.scopeAverage === null ? null : (
                  <line
                    key={`a-${r.weekStart}`}
                    x1={xOf(i) - barWidth / 2 - 2}
                    x2={xOf(i) + barWidth / 2 + 2}
                    y1={yOf(Math.max(r.scopeAverage, 0))}
                    y2={yOf(Math.max(r.scopeAverage, 0))}
                    className={styles.average}
                  />
                )
              )}
            </>
          ) : (
            <>
              <path d={`M ${linePoints.map((p) => `${p.x},${p.y}`).join(" L ")}`} fill="none" className={styles.line} />
              {linePoints.map((p) => (
                <circle key={p.i} cx={p.x} cy={p.y} r={p.i === shown ? 4 : 2.5} className={styles.dot} />
              ))}
            </>
          )}
          {rows.map((r, i) => (
            <rect
              key={`hit-${r.weekStart}`}
              x={xOf(i) - (X1 - X0) / n / 2}
              y={0}
              width={(X1 - X0) / n}
              height={H}
              fill="transparent"
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => setActiveIndex(i)}
            />
          ))}
          <text x={X0} y={H - 6} textAnchor="start" className={styles.axisLabel}>
            {shortDate(rows[0].weekStart)}
          </text>
          <text x={X1} y={H - 6} textAnchor="end" className={styles.axisLabel}>
            {shortDate(rows[n - 1].weekStart)}
          </text>
        </svg>
      </div>

      <p className={styles.legend}>
        {current === "points" && hasScopeDetails
          ? "Le trait horizontal sur chaque barre marque la moyenne des joueurs de la portée."
          : current === "rank"
            ? "Classement en fin de semaine, le 1er en haut."
            : "Touche un point du graphique pour voir la semaine."}
      </p>
    </div>
  );
}
