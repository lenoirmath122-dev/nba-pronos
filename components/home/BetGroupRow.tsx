import type { BetTodoItem } from "@/lib/queries/home";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import styles from "./BetGroupRow.module.css";

// Une ligne-groupe de la section « Paris » (15/08/2026) : résumé cliquable
// (déplié/replié) + liste des séries/matchs encore ouverts, exactement le
// même patron contrôlé (expanded/onToggle) que components/leaderboard/
// LeaderboardRow.tsx — l'état (quel groupe est ouvert) est levé dans
// BetsAccordionList.tsx, ce composant n'en a aucune connaissance.

type BetGroupRowProps = {
  label: string; // « Séries » / « Matchs »
  items: BetTodoItem[];
  feminine: boolean; // accord de « encore ouvert(e)(s) »
  expanded: boolean;
  onToggle: () => void;
};

function summary(label: string, count: number, feminine: boolean): string {
  const adjective = feminine ? "ouverte" : "ouvert";
  return `${label} · ${count} encore ${adjective}${count > 1 ? "s" : ""}`;
}

export function BetGroupRow({ label, items, feminine, expanded, onToggle }: BetGroupRowProps) {
  return (
    <div>
      <div {...clickableRowProps(onToggle)} className={styles.summary} aria-expanded={expanded}>
        <span className={styles.summaryLabel}>{summary(label, items.length, feminine)}</span>
        <span className={styles.chevron} aria-hidden="true">
          {expanded ? "⌃" : "⌄"}
        </span>
      </div>

      {expanded && (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <a href={item.href} className={styles.row}>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.itemChevron} aria-hidden="true">
                  ›
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
