import type { FeedItem } from "@/lib/queries/home";
import styles from "./FeedRow.module.css";

type FeedRowProps = {
  item: FeedItem;
};

const OUTCOME_STYLE: Record<FeedItem["outcome"], string> = {
  win: styles.win,
  loss: styles.loss,
  neutral: styles.neutral,
};

export function FeedRow({ item }: FeedRowProps) {
  // Seul le pari statué "neutralisé" (bet_resolved) est barré/grisé — jamais
  // un résultat gagné/perdu, qui reste un rendu de jeu normal (T6c §4).
  const cancelled = item.kind === "bet_resolved";

  return (
    <li className={cancelled ? styles.rowCancelled : styles.row}>
      <div className={styles.text}>
        <p className={styles.label}>{item.label}</p>
        {item.detail && <p className={styles.detail}>{item.detail}</p>}
      </div>
      <span className={`${styles.points} ${OUTCOME_STYLE[item.outcome]}`}>
        {formatPoints(item.points)}
      </span>
    </li>
  );
}

// Pivot A1 : null = rien joué ("-"), 0 = scoré-zéro ("0").
function formatPoints(points: number | null): string {
  if (points === null) return "-";
  return `${points} pt${points > 1 ? "s" : ""}`;
}
