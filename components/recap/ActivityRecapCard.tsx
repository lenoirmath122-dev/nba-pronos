import { WinIcon, LossIcon, NeutralIcon } from "@/components/icons/home-icons";
import type { FeedItem } from "@/lib/queries/home";
import type { RecapSummary } from "@/lib/recap/summary";
import styles from "./ActivityRecapCard.module.css";

// Contenu de la popup « depuis ta dernière visite » : total de points, puis
// les pronos et les paris corrigés. Mêmes icônes et même règle de couleur que
// FeedRow (vert/rouge réservés au gagné/perdu, un pari neutralisé reste gris).

const OUTCOME_ICON: Record<FeedItem["outcome"], typeof WinIcon> = {
  win: WinIcon,
  loss: LossIcon,
  neutral: NeutralIcon,
};
const OUTCOME_CLASS: Record<FeedItem["outcome"], string> = {
  win: styles.win,
  loss: styles.loss,
  neutral: styles.neutral,
};

function formatPoints(points: number | null): string {
  if (points === null) return "-";
  return `${points} pt${points > 1 ? "s" : ""}`;
}

function RecapSection({ heading, items }: { heading: string; items: FeedItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section}>
      <h3 className={styles.heading}>{heading}</h3>
      <ul className={styles.list}>
        {items.map((item, index) => {
          const Icon = OUTCOME_ICON[item.outcome];
          return (
            <li key={`${item.occurredAt}-${index}`} className={styles.row}>
              <span className={`${styles.icon} ${OUTCOME_CLASS[item.outcome]}`} aria-hidden="true">
                <Icon size={14} />
              </span>
              <div className={styles.text}>
                <p className={styles.label}>{item.label}</p>
                {item.detail && <p className={styles.detail}>{item.detail}</p>}
              </div>
              <span className={`${styles.points} ${OUTCOME_CLASS[item.outcome]}`}>{formatPoints(item.points)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ActivityRecapCard({ summary, children }: { summary: RecapSummary; children?: React.ReactNode }) {
  return (
    <div className={styles.card}>
      <p className={styles.total}>
        <span className={styles.totalValue}>{formatPoints(summary.totalPoints)}</span> gagnés depuis ta dernière visite
      </p>
      <RecapSection heading="Mes pronos" items={summary.matches} />
      <RecapSection heading="Mes paris" items={summary.bets} />
      {children}
    </div>
  );
}
