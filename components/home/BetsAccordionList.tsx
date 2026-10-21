import type { BetTodoItem } from "@/lib/queries/home";
import { BetGroupRow } from "./BetGroupRow";
import styles from "./BetsAccordionList.module.css";

type BetsAccordionListProps = {
  seriesBets: BetTodoItem[];
  matchBets: BetTodoItem[];
};

// Liste de la section « Proposer un pari » (15/08/2026) : plus d'accordéon
// depuis le 22/10/2026, les groupes Séries / Matchs sont affichés à plat. Un
// groupe vide n'est pas rendu du tout (jamais d'état vide ici).
export function BetsAccordionList({ seriesBets, matchBets }: BetsAccordionListProps) {
  return (
    <div className={styles.wrapper}>
      {seriesBets.length > 0 && <BetGroupRow label="Séries" items={seriesBets} feminine />}
      {matchBets.length > 0 && <BetGroupRow label="Matchs" items={matchBets} feminine={false} />}
    </div>
  );
}
