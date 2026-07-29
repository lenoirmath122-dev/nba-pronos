import type { BracketData, SeriesLiveSeed } from "@/lib/queries/bracket";
import { Countdown } from "@/components/ui/Countdown";
import { ProgressBar } from "./ProgressBar";
import { SeriesDrillDown } from "./SeriesDrillDown";
import { TreeView } from "./TreeView";
import { LiveSeriesSubscriber } from "./LiveSeriesSubscriber";
import styles from "./BracketSummary.module.css";

// Vue A « résumé par tour » (défaut, §10) : état réel + tendances, groupé
// par tour, progression X/15 ou X/7. Composant serveur — l'interactivité
// (drill-down, bascule vue B) vit dans SeriesDrillDown/TreeView.
type BracketSummaryProps = {
  data: BracketData;
  competitionName: string;
  initialShowTree: boolean;
  liveSeed: SeriesLiveSeed[];
};

export function BracketSummary({ data, competitionName, initialShowTree, liveSeed }: BracketSummaryProps) {
  return (
    <LiveSeriesSubscriber seed={liveSeed}>
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <p className={styles.title}>Bracket</p>
            <p className={styles.competitionName}>{competitionName}</p>
          </div>
          <ProgressBar filledCount={data.filledCount} totalCount={data.totalCount} />
        </div>

        <TreeView data={data} initialShow={initialShowTree} />

        {/* Avant la deadline (§13) : structure seule, compte à rebours, ni
            tendance ni nom. Les groupes sont déjà vides côté serveur : le tap
            sur une série n'aura donc aucun effet (SeriesDrillDown). */}
        {!data.isDeadlinePassed && (
          <div className={styles.beforeDeadline}>
            {data.deadline ? (
              <Countdown deadline={data.deadline} href="/bracket">
                <span className={styles.beforeDeadlineText}>
                  Les brackets des joueurs seront visibles après la deadline.
                </span>
              </Countdown>
            ) : (
              <p className={styles.beforeDeadlineText}>
                Les brackets des joueurs seront visibles après la deadline.
              </p>
            )}
          </div>
        )}

        <SeriesDrillDown rounds={data.rounds} isDeadlinePassed={data.isDeadlinePassed} view="A" />
      </div>
    </LiveSeriesSubscriber>
  );
}
