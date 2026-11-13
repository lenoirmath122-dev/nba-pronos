import { ExternalLink } from "lucide-react";
import type { NightBundle } from "@/lib/queries/home";
import type { RecapBet } from "@/lib/recaps/build";
import { emptyReactionSummary, reactionKey } from "@/lib/recaps/reactions";
import { joinPseudos, ordinal, probaLabel } from "@/lib/recaps/text";
import {
  chatReplyHref,
  nightLabel,
  nightTally,
  replyToBestBet,
  replyToTopScorers,
  tallyLabel,
} from "@/lib/news/night";
import { Feed } from "@/components/home/Feed";
import { Disclosure } from "./Disclosure";
import { ReactionBar } from "./ReactionBar";
import styles from "./NightCard.module.css";

// Carte d'une nuit du fil Actualité (13/11/2026, maquette validée avec
// l'utilisateur) : tes points et ton rang en premier, puis les highlights de
// la ligue (réactions + Répondre), tes paris de la nuit au tap, et les scores.
// Remplace « Résultats de la nuit » (RecapBlock journalier + liste 48 h).

type NightCardProps = {
  night: NightBundle;
  competitionId: string;
  /** id de la section : "recap" pour la nuit en cours (cible du push), sinon
   *  nuit-AAAA-MM-JJ (ancre du bouton « Nuit précédente »). */
  anchorId: string;
};

function betMeta(bet: RecapBet): string {
  const parts = [bet.pseudo];
  if (bet.difficulty !== null) parts.push(`difficulté ${bet.difficulty}`);
  if (bet.proba !== null) parts.push(`${probaLabel(bet.proba)} de chances`);
  return parts.join(" · ");
}

export function NightCard({ night, competitionId, anchorId }: NightCardProps) {
  const { view, items, recapDate } = night;
  const me = view?.me ?? null;
  const tally = nightTally(items);
  const reactionsFor = (target: "TOP_SCORERS" | "BEST_BET") =>
    night.reactions[reactionKey(recapDate, target)] ?? emptyReactionSummary();
  const label = nightLabel(recapDate);

  return (
    <section id={anchorId} className={`${styles.card} glass-card`} aria-label={label}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{label}</h2>
        {view?.inProgress && <span className={styles.pill}>en cours</span>}
      </div>

      {me?.played || tally.settled > 0 ? (
        <div className={styles.me}>
          <div className={styles.headline}>
            <p className={styles.points}>
              <span className={styles.pointsValue}>{me && me.pointsGained > 0 ? `+${me.pointsGained}` : "0"}</span>
              <span className={styles.pointsUnit}>{me && me.pointsGained > 1 ? "pts" : "pt"}</span>
            </p>
            {me?.rank != null && (
              <p className={styles.rank}>
                <span className={styles.rankValue}>{ordinal(me.rank)}</span>
                <span className={styles.rankLabel}>
                  {me.rankDelta ? (
                    <span className={me.rankDelta > 0 ? styles.deltaUp : styles.deltaDown}>
                      {me.rankDelta > 0 ? `▲ ${me.rankDelta}` : `▼ ${-me.rankDelta}`}
                    </span>
                  ) : (
                    "au classement"
                  )}
                </span>
              </p>
            )}
          </div>
          {tally.settled > 0 && (
            <div className={styles.tally}>
              <div className={styles.segments} aria-hidden="true">
                {items
                  .filter((item) => item.outcome !== "neutral")
                  .map((item, index) => (
                    <span key={index} className={item.outcome === "win" ? styles.segmentWin : styles.segment} />
                  ))}
              </div>
              <p className={styles.tallyText}>{tallyLabel(tally)}</p>
            </div>
          )}
          {me && me.passed.length > 0 && (
            <p className={styles.muted}>Tu passes devant {joinPseudos(me.passed.map((pseudo) => ({ pseudo })))}.</p>
          )}
        </div>
      ) : (
        <p className={styles.empty}>
          {view?.inProgress ? "Rien de tranché pour toi pour l'instant." : "Rien de tranché pour toi cette nuit."}
        </p>
      )}

      {view && (view.topScorers.length > 0 || view.bestBet) && (
        <ul className={styles.highlights}>
          {view.topScorers.length > 0 && (
            <li className={styles.highlight}>
              <div className={styles.highlightBody}>
                <div className={styles.highlightText}>
                  <p className={styles.highlightTitle}>Meilleure nuit</p>
                  <p className={styles.highlightMain}>{joinPseudos(view.topScorers)}</p>
                </div>
                <span className={styles.highlightValue}>+{view.topScorers[0].value}</span>
              </div>
              <ReactionBar
                competitionId={competitionId}
                recapDate={recapDate}
                target="TOP_SCORERS"
                initial={reactionsFor("TOP_SCORERS")}
                replyHref={chatReplyHref(replyToTopScorers(view.topScorers))}
                subject="meilleure nuit"
              />
            </li>
          )}
          {view.bestBet && (
            <li className={styles.highlight}>
              <div className={styles.highlightBody}>
                <div className={styles.highlightText}>
                  <p className={styles.highlightTitle}>Plus gros pari réussi</p>
                  <p className={styles.highlightMain}>« {view.bestBet.description} »</p>
                  <p className={styles.muted}>{betMeta(view.bestBet)}</p>
                </div>
              </div>
              <ReactionBar
                competitionId={competitionId}
                recapDate={recapDate}
                target="BEST_BET"
                initial={reactionsFor("BEST_BET")}
                replyHref={chatReplyHref(replyToBestBet(view.bestBet))}
                subject="plus gros pari réussi"
              />
            </li>
          )}
        </ul>
      )}

      {view && view.nightMatches.length > 0 && (
        <div className={styles.scores}>
          <p className={styles.sectionTitle}>Scores de la nuit</p>
          <ul className={styles.scoreList}>
            {view.nightMatches.map((match) => (
              <li key={match.id} className={styles.score}>
                {match.label}
              </li>
            ))}
          </ul>
          <a href={view.debriefUrl} target="_blank" rel="noopener noreferrer" className={styles.debrief}>
            Débrief TrashTalk <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {items.length > 0 && (
        <Disclosure
          openLabel={`Voir mes ${items.length} pari${items.length > 1 ? "s" : ""}`}
          closeLabel="Masquer mes paris"
        >
          <Feed items={items} />
        </Disclosure>
      )}
    </section>
  );
}

