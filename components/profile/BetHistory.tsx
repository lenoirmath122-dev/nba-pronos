"use client";

import { useMemo, useState } from "react";
import type { BetHistoryItem } from "@/lib/queries/betHistory";
import styles from "./BetHistory.module.css";

// Historique complet des paris (Stats > Paris) : deux menus déroulants, un
// filtre par résultat (tous / réussis / ratés) et un tri (date ou points,
// croissant ou décroissant). Données déjà chargées côté serveur, tri local.
type Result = "all" | "won" | "lost";
type Sort = "date-desc" | "date-asc" | "points-desc" | "points-asc";

const RESULTS: { id: Result; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "won", label: "Réussis" },
  { id: "lost", label: "Ratés" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "date-desc", label: "Date décroissante" },
  { id: "date-asc", label: "Date croissante" },
  { id: "points-desc", label: "Points décroissants" },
  { id: "points-asc", label: "Points croissants" },
];

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

export function BetHistory({ items }: { items: BetHistoryItem[] }) {
  const [sort, setSort] = useState<Sort>("date-desc");
  const [result, setResult] = useState<Result>("all");

  const rows = useMemo(() => {
    const filtered = items.filter((item) => result === "all" || item.won === (result === "won"));
    const sign = sort.endsWith("desc") ? -1 : 1;
    const byDate = (a: BetHistoryItem, b: BetHistoryItem) => (a.resolvedAt ?? "").localeCompare(b.resolvedAt ?? "");
    return [...filtered].sort((a, b) =>
      sort.startsWith("points") ? sign * (a.points - b.points) || -byDate(a, b) : sign * byDate(a, b)
    );
  }, [items, result, sort]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <select
          className={styles.select}
          aria-label="Filtrer par résultat"
          value={result}
          onChange={(event) => setResult(event.target.value as Result)}
        >
          {RESULTS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          aria-label="Trier les paris"
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
        >
          {SORTS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <p className={styles.empty}>Aucun pari dans ce filtre.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((item) => {
            const meta = [
              item.categoryLabel,
              item.difficultyLabel,
              item.competitionName,
              item.resolvedAt ? DATE_FORMATTER.format(new Date(item.resolvedAt)) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={item.betId} className={styles.item}>
                <span className={item.won ? styles.won : styles.lost}>{item.won ? "Réussi" : "Raté"}</span>
                <div className={styles.body}>
                  <p className={styles.description}>{item.description}</p>
                  {meta && <p className={styles.meta}>{meta}</p>}
                </div>
                <span className={item.won ? styles.pointsWon : styles.pointsLost}>
                  {item.won ? `+${item.points}` : "0"} pt{item.points > 1 ? "s" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
