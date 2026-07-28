import type { SeriesBetTodoItem } from "@/lib/queries/home";
import styles from "./SeriesBetList.module.css";

// Section « Paris séries » (demandée par l'utilisateur 28/07/2026) : LISTE
// chaque série où un pari reste possible, contrairement au bloc « À
// traiter » qui agrège en un seul item par univers — d'où un composant
// dédié plutôt qu'un TodoItem détourné de son usage. Chaque lien pointe
// directement sur la carte de série concernée (ancre #series-<id>, posée
// par BracketFillBoard.tsx).

type SeriesBetListProps = { items: SeriesBetTodoItem[] };

export function SeriesBetList({ items }: SeriesBetListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.seriesId} className={styles.item}>
          <a href={item.href} className={styles.row}>
            <span className={styles.title}>{item.title}</span>
            <span className={styles.chevron} aria-hidden="true">
              ›
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
