import { ChevronRight } from "lucide-react";
import type { BetTodoItem } from "@/lib/queries/home";
import styles from "./BetGroupRow.module.css";

// Un groupe de la section « Proposer un pari » : intitulé + liste des
// séries/matchs encore ouverts, toujours affichés (l'accordéon interne
// Séries/Matchs a été retiré le 22/10/2026 : trop de menus déroulants sur
// l'Accueil, la carte « Proposer un pari » reste le seul repli).

type BetGroupRowProps = {
  label: string; // « Séries » / « Matchs »
  items: BetTodoItem[];
  feminine: boolean; // accord de « encore ouvert(e)(s) »
};

function summary(label: string, count: number, feminine: boolean): string {
  const adjective = feminine ? "ouverte" : "ouvert";
  return `${label} · ${count} encore ${adjective}${count > 1 ? "s" : ""}`;
}

export function BetGroupRow({ label, items, feminine }: BetGroupRowProps) {
  return (
    <div>
      <p className={styles.summary}>
        <span className={styles.summaryLabel}>{summary(label, items.length, feminine)}</span>
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <a href={item.href} className={styles.row}>
              <span className={styles.title}>{item.title}</span>
              <ChevronRight size={16} strokeWidth={2.25} className={styles.itemChevron} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
