import type { BracketData, SeriesLiveSeed } from "@/lib/queries/bracket";
import type { MyLeague } from "@/lib/queries/leagues";
import { Countdown } from "@/components/ui/Countdown";
import { ProgressBar } from "./ProgressBar";
import { SeriesDrillDown } from "./SeriesDrillDown";
import { TreeView } from "./TreeView";
import { LeagueScopeChips } from "./LeagueScopeChips";
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
  myLeagues: MyLeague[];
  /** Joueur connecté (pas un simple visiteur) — écran partagé visiteur/joueur
   *  (§9). Conditionne UNIQUEMENT le raccourci « Parier sur cette série »
   *  (04/08/2026, demandé par l'utilisateur), rien d'autre sur cet écran. */
  canBet: boolean;
};

export function BracketSummary({ data, competitionName, initialShowTree, liveSeed, myLeagues, canBet }: BracketSummaryProps) {
  // Paris SÉRIE : PLAYOFFS uniquement (NBA Cup les refuse déjà côté
  // save_bet/migration #10 — même garde que BracketFillBoard.tsx).
  const showBetLink = canBet && data.competitionType === "PLAYOFFS";
  return (
    <LiveSeriesSubscriber seed={liveSeed}>
      <div className={styles.page}>
        <div className={`${styles.header} hero-banner`}>
          <div>
            <p className={`${styles.title} hero-banner-title`}>Bracket</p>
            <p className={`${styles.competitionName} hero-banner-subtitle`}>
              {competitionName}
              {data.scopeLeagueName ? ` — ${data.scopeLeagueName}` : ""}
            </p>
          </div>
          <ProgressBar filledCount={data.filledCount} totalCount={data.totalCount} />
        </div>

        <LeagueScopeChips myLeagues={myLeagues} activeLeagueId={data.scopeLeagueId} showTree={initialShowTree} />

        <TreeView data={data} initialShow={initialShowTree} showBetLink={showBetLink} />

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

        <SeriesDrillDown
          rounds={data.rounds}
          isDeadlinePassed={data.isDeadlinePassed}
          view="A"
          competitionType={data.competitionType}
          showBetLink={showBetLink}
        />
      </div>
    </LiveSeriesSubscriber>
  );
}
