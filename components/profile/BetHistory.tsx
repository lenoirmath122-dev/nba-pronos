"use client";

import { useMemo, useState } from "react";
import type { BetHistoryItem } from "@/lib/queries/betHistory";
import styles from "./BetHistory.module.css";

// Historique complet des paris (Stats > Paris) : réussis et ratés, filtre par
// résultat, tri par date ou par points (un second tap sur le tri actif inverse
// le sens). Données déjà chargées côté serveur, tri purement local.
type SortKey = "date" | "points";
type Result = "all" | "won" | "lost";

const RESULTS: { id: Result; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "won", label: "Réussis" },
  { id: "lost", label: "Ratés" },
];

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

export function BetHistory({ items }: { items: BetHistoryItem[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: true });
  const [result, setResult] = useState<Result>("all");

  const rows = useMemo(() => {
    const filtered = items.filter((item) => result === "all" || item.won === (result === "won"));
    const sign = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "points") {
        return sign * (a.points - b.points) || (b.resolvedAt ?? "").localeCompare(a.resolvedAt ?? "");
      }
      return sign * (a.resolvedAt ?? "").localeCompare(b.resolvedAt ?? "");
    });
  }, [items, result, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, desc: !current.desc } : { key, desc: true }));
  }

  const arrow = (key: SortKey) => (sort.key === key ? (sort.desc ? " ↓" : " ↑") : "");

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <div className={styles.group} role="group" aria-label="Filtrer par résultat">
          {RESULTS.map(({ id, label }) => (
            <button key={id} type="button" className={styles.chip} aria-pressed={result === id} onClick={() => setResult(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.group} role="group" aria-label="Trier">
          <button type="button" className={styles.chip} aria-pressed={sort.key === "date"} onClick={() => toggleSort("date")}>
            Date{arrow("date")}
          </button>
          <button type="button" className={styles.chip} aria-pressed={sort.key === "points"} onClick={() => toggleSort("points")}>
            Points{arrow("points")}
          </button>
        </div>
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
