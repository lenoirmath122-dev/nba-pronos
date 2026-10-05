import { Crosshair, ExternalLink, Flame, Shuffle, Target, TrendingUp } from "lucide-react";
import type { RecapBet, RecapPlayer } from "@/lib/recaps/build";
import type { RecapView } from "@/lib/recaps/home";
import {
  joinPseudos,
  ordinal,
  personalDetail,
  pointsLabel,
  probaLabel,
  rankDeltaLabel,
} from "@/lib/recaps/text";
import styles from "./RecapBlock.module.css";

// Récap « Ta nuit » / « Ta semaine » (p3-10 + p3-11), posé en tête de
// « Ça vient de tomber ». Contenu cadré avec l'utilisateur le 05/10/2026 :
// toi (points, rang, détail), la compet' (qui a pris le plus de points, plus
// gros pari réussi ; en hebdo classement de la semaine, remontée, sniper,
// plus loufoque perdu), scores de la nuit avec débrief TrashTalk.

type RecapBlockProps = { view: RecapView };

function betSubtitle(bet: RecapBet): string {
  const parts = [bet.pseudo];
  if (bet.difficulty !== null) parts.push(`difficulté ${bet.difficulty}`);
  if (bet.proba !== null) parts.push(probaLabel(bet.proba));
  return parts.join(" · ");
}

function Distinction({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className={styles.distinction}>
      <span className={styles.distinctionIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.distinctionText}>
        <p className={styles.distinctionTitle}>{title}</p>
        {children}
      </div>
    </li>
  );
}

function playersWith(players: RecapPlayer[], suffix: (value: number) => string) {
  return (
    <p className={styles.distinctionBody}>
      {joinPseudos(players)} <span className={styles.muted}>{suffix(players[0].value)}</span>
    </p>
  );
}

function betBody(bet: RecapBet) {
  return (
    <>
      <p className={styles.distinctionBody}>« {bet.description} »</p>
      <p className={styles.muted}>{betSubtitle(bet)}</p>
    </>
  );
}

export function RecapBlock({ view }: RecapBlockProps) {
  const weekly = view.kind === "WEEKLY";
  const me = view.me;
  const title = weekly ? "Ta semaine" : "Ta nuit";
  const detail = me?.played ? personalDetail(me) : "";
  const meInTop = view.weeklyTop.some((entry) => entry.isMe);

  return (
    <div className={styles.block} aria-label={title}>
      <div className={styles.heading}>
        <p className={styles.title}>{title}</p>
        {view.inProgress && <span className={styles.pill}>en cours</span>}
      </div>

      {me?.played ? (
        <div className={styles.me}>
          <p className={styles.headline}>
            <span className={styles.points}>{me.pointsGained > 0 ? `+${pointsLabel(me.pointsGained)}` : "0 pt"}</span>
            {me.rank !== null && (
              <span className={styles.rank}>
                {ordinal(me.rank)}
                {rankDeltaLabel(me.rankDelta) && <span className={styles.delta}>{rankDeltaLabel(me.rankDelta)}</span>}
              </span>
            )}
          </p>
          {detail && <p className={styles.detail}>{detail}</p>}
          {me.passed.length > 0 && <p className={styles.detail}>Tu passes devant {joinPseudos(me.passed.map((pseudo) => ({ pseudo })))}.</p>}
        </div>
      ) : (
        <p className={styles.detail}>
          {weekly ? "Rien de tranché pour toi cette semaine. À toi de jouer !" : "Rien de tranché pour toi cette nuit."}
        </p>
      )}

      {weekly && view.weeklyTop.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Classement de la semaine</p>
          <ol className={styles.ranking}>
            {view.weeklyTop.map((entry) => (
              <li key={entry.userId} className={entry.isMe ? styles.rankingRowMe : styles.rankingRow}>
                <span className={styles.rankingPlace}>{ordinal(entry.rank)}</span>
                <span className={styles.rankingName}>{entry.pseudo}</span>
                <span className={styles.rankingPoints}>+{pointsLabel(entry.value)}</span>
              </li>
            ))}
          </ol>
          {me && me.periodRank !== null && !meInTop && (
            <p className={styles.muted}>
              Toi : {ordinal(me.periodRank)} (+{pointsLabel(me.pointsGained)})
            </p>
          )}
        </div>
      )}

      <ul className={styles.distinctions}>
        {!weekly && view.topScorers.length > 0 && (
          <Distinction icon={<Flame size={16} />} title="Meilleure nuit">
            {playersWith(view.topScorers, (value) => `+${pointsLabel(value)}`)}
          </Distinction>
        )}
        {weekly && view.biggestClimb.length > 0 && (
          <Distinction icon={<TrendingUp size={16} />} title="Plus grosse remontée">
            {playersWith(view.biggestClimb, (value) => `+${value} place${value > 1 ? "s" : ""}`)}
          </Distinction>
        )}
        {weekly && view.sniper.length > 0 && (
          <Distinction icon={<Crosshair size={16} />} title="Sniper">
            {playersWith(view.sniper, (value) => `${value} écart${value > 1 ? "s" : ""} exact${value > 1 ? "s" : ""}`)}
          </Distinction>
        )}
        {view.bestBet && (
          <Distinction icon={<Target size={16} />} title={weekly ? "Pari de la semaine" : "Plus gros pari réussi"}>
            {betBody(view.bestBet)}
          </Distinction>
        )}
        {view.craziestLostBet && (
          <Distinction icon={<Shuffle size={16} />} title="Le plus loufoque (perdu)">
            {betBody(view.craziestLostBet)}
          </Distinction>
        )}
      </ul>

      {view.nightMatches.length > 0 && (
        <div className={styles.section}>
          <p className={styles.sectionTitle}>Scores de la nuit</p>
          <ul className={styles.scores}>
            {view.nightMatches.map((match) => (
              <li key={match.id} className={styles.scoreRow}>
                <span>{match.label}</span>
                {match.articleUrl && (
                  <a href={match.articleUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    Débrief
                  </a>
                )}
              </li>
            ))}
          </ul>
          <a href={view.debriefUrl} target="_blank" rel="noopener noreferrer" className={styles.debrief}>
            Tout le débrief sur TrashTalk <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}
