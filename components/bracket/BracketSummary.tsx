import Link from "next/link";
import type { BracketData, SeriesLiveSeed } from "@/lib/queries/bracket";
import type { MyLeague } from "@/lib/queries/leagues";
import { Countdown } from "@/components/ui/Countdown";
import { ProgressBar } from "./ProgressBar";
import { SeriesDrillDown } from "./SeriesDrillDown";
import { LeagueScopeChips } from "./LeagueScopeChips";
import { LiveSeriesSubscriber } from "./LiveSeriesSubscriber";
import styles from "./BracketSummary.module.css";

// Bracket de consultation : l'arbre en plein écran est le SEUL rendu depuis
// le 04/10/2026 (retour de l'alpha, suite de p3-4 — l'utilisateur, après la
// deadline, retombait sur l'ancienne Vue A « résumé par tour » en cartes en
// touchant « Quitter » de l'arbre). Ce que portait la Vue A est remonté dans
// l'en-tête de l'arbre : progression, filtre par ligue, compte à rebours
// avant deadline. « Quitter » sort de l'écran : onglet Jouer pour un joueur,
// Classement pour un visiteur (qui n'a pas accès à /play). Composant
// serveur — l'interactivité (drill-down) vit dans SeriesDrillDown.
//
// Overlay PLEIN VIEWPORT (§10.1) — jamais l'API Fullscreen (indisponible sur
// iPhone/Safari). Zoom natif (pincer) : aucune règle ne restreint touch-action.
type BracketSummaryProps = {
  data: BracketData;
  competitionName: string;
  liveSeed: SeriesLiveSeed[];
  myLeagues: MyLeague[];
  /** Joueur connecté (pas un simple visiteur) — écran partagé visiteur/joueur
   *  (§9). Conditionne le raccourci « Parier sur cette série » (04/08/2026,
   *  demandé par l'utilisateur) et la destination de « Quitter ». */
  canBet: boolean;
};

export function BracketSummary({ data, competitionName, liveSeed, myLeagues, canBet }: BracketSummaryProps) {
  // Paris SÉRIE : PLAYOFFS uniquement (NBA Cup les refuse déjà côté
  // save_bet/migration #10).
  const showBetLink = canBet && data.competitionType === "PLAYOFFS";
  return (
    <LiveSeriesSubscriber seed={liveSeed}>
      <div className={styles.overlay}>
        <div className={styles.header}>
          <Link href={canBet ? "/play" : "/leaderboard"} className={styles.close}>
            × Quitter
          </Link>
          <div className={styles.headerTexts}>
            <p className={styles.title}>Bracket</p>
            <p className={styles.competitionName}>
              {competitionName}
              {data.scopeLeagueName ? ` — ${data.scopeLeagueName}` : ""}
            </p>
          </div>
          <div className={styles.progress}>
            <ProgressBar filledCount={data.filledCount} totalCount={data.totalCount} />
          </div>
        </div>

        <div className={styles.toolbar}>
          <LeagueScopeChips myLeagues={myLeagues} activeLeagueId={data.scopeLeagueId} />

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
        </div>

        <div className={styles.treeArea}>
          <SeriesDrillDown rounds={data.rounds} isDeadlinePassed={data.isDeadlinePassed} showBetLink={showBetLink} />
        </div>
      </div>
    </LiveSeriesSubscriber>
  );
}
