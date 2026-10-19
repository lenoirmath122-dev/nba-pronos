"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { HomeMatch, HomeTeam } from "@/lib/publicHome/query";
import {
  BASKET_KEY,
  MARGIN_MAX,
  MARGIN_MIN,
  parseBasket,
  pruneBasket,
  removeItem,
  upsertItem,
  type BasketItem,
  type OpenMatch,
} from "@/lib/publicHome/basket";
import { trackFunnel } from "@/lib/funnel/track";
import { remainingLabel } from "@/lib/publicHome/labels";
import styles from "./HomePlay.module.css";

// Blocs 2 à 5 de l'accueil public (plan d'attractivité, §1.4) : match de la
// nuit, écart, prochains matchs et barre « Mes pronos ». Le panier vit dans
// localStorage (§1.6 a) jusqu'à l'écran d'enregistrement, qui envoie tout en
// base. Le rendu serveur et le premier rendu client ne lisent ni l'horloge ni
// le stockage : tout arrive après montage, sans décalage d'hydratation.

type Split = { total: number; homePercent: number; awayPercent: number };

type Props = {
  live: HomeMatch | null;
  featured: HomeMatch | null;
  next: HomeMatch[];
  splits: Record<string, Split>;
  /** Surtitre du match mis en avant, calculé côté serveur. */
  featuredKicker: string | null;
  /** Écran d'enregistrement (tâche 5) ; /enregistrer. */
  saveHref?: string;
};

type Draft = { matchId: string; winnerTeamId: string; margin: number };

function readStorage(): BasketItem[] {
  try {
    return parseBasket(window.localStorage.getItem(BASKET_KEY));
  } catch {
    return [];
  }
}

function writeStorage(items: BasketItem[]) {
  try {
    window.localStorage.setItem(BASKET_KEY, JSON.stringify(items));
  } catch {
    // Stockage indisponible (navigateur intégré, mode privé) : le panier reste en mémoire.
  }
}

export function HomePlay({ live, featured, next, splits, featuredKicker, saveHref = "/enregistrer" }: Props) {
  const open = useMemo(() => [featured, ...next].filter((m): m is HomeMatch => m !== null), [featured, next]);
  const openMatches: OpenMatch[] = useMemo(
    () => open.map((m) => ({ id: m.id, scheduledAt: m.scheduledAt, homeTeamId: m.home.id, awayTeamId: m.away.id })),
    [open],
  );

  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    trackFunnel("home_view");
  }, []);

  // Chargement du panier, puis nettoyage des matchs commencés (§1.5).
  useEffect(() => {
    const load = () => {
      const { kept, removed } = pruneBasket(readStorage(), openMatches, Date.now());
      if (removed.length > 0) {
        writeStorage(kept);
        setNotice("Match commencé, prono retiré.");
      }
      setBasket(kept);
      setNow(Date.now());
      setLoaded(true);
    };
    load();
  }, [openMatches]);

  // Horloge locale : compte à rebours et retrait des matchs qui démarrent.
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setBasket((current) => {
        const { kept, removed } = pruneBasket(current, openMatches, t);
        if (removed.length === 0) return current;
        writeStorage(kept);
        setNotice("Match commencé, prono retiré.");
        return kept;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [openMatches]);

  const commit = useCallback((items: BasketItem[]) => {
    setBasket(items);
    writeStorage(items);
  }, []);

  const saveProno = (match: HomeMatch, winnerTeamId: string, margin: number) => {
    commit(
      upsertItem(basket, {
        matchId: match.id,
        competitionId: match.competitionId,
        winnerTeamId,
        margin,
        addedAt: Date.now(),
      }),
    );
  };

  // Le prono entre dans le panier dès le choix de l'équipe (écart par défaut 7) ;
  // le curseur ne fait ensuite que le corriger.
  const startDraft = (match: HomeMatch, team: HomeTeam) => {
    const existing = basket.find((i) => i.matchId === match.id);
    const margin = existing && existing.winnerTeamId === team.id ? existing.margin : 7;
    setNotice(null);
    trackFunnel("team_picked", match.id);
    setDraft({ matchId: match.id, winnerTeamId: team.id, margin });
    saveProno(match, team.id, margin);
    trackFunnel("prono_added", match.id);
  };

  const changeMargin = (match: HomeMatch, margin: number) => {
    if (!draft || draft.matchId !== match.id) return;
    setDraft({ ...draft, margin });
    saveProno(match, draft.winnerTeamId, margin);
  };

  const cancelProno = (matchId: string) => {
    commit(removeItem(basket, matchId));
    setDraft((d) => (d?.matchId === matchId ? null : d));
  };

  const cardProps = {
    basket,
    draft,
    splits,
    now,
    onPick: startDraft,
    onMargin: changeMargin,
    onCancel: cancelProno,
  };

  return (
    <>
      {live ? (
        <section className={`${styles.live} glass-card`} aria-label="Match en cours">
          <span className={styles.liveBadge}>En cours</span>
          <span className={styles.liveTeams}>
            {live.home.name}
            {live.homeScore !== null && live.awayScore !== null ? ` ${live.homeScore} – ${live.awayScore} ` : " – "}
            {live.away.name}
          </span>
        </section>
      ) : null}

      {featured ? (
        <section className={styles.featured} aria-labelledby="featured-title">
          {featuredKicker ? <p className={styles.kicker}>{featuredKicker}</p> : null}
          <h1 id="featured-title" className={styles.title}>
            {featured.home.name} ou {featured.away.name} ? Fais ton prono.
          </h1>
          {now !== null ? (
            <p className={styles.countdown}>Pronos ouverts encore {remainingLabel(Date.parse(featured.scheduledAt) - now)}</p>
          ) : (
            <p className={styles.countdown} aria-hidden="true">
              &nbsp;
            </p>
          )}
          <MatchCard match={featured} big {...cardProps} />
        </section>
      ) : (
        <section className={styles.featured} aria-labelledby="featured-title">
          <h1 id="featured-title" className={styles.title}>
            Prochains matchs bientôt disponibles
          </h1>
          <p className={styles.countdown}>Reviens dans quelques heures : les matchs de la semaine arrivent.</p>
        </section>
      )}

      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}

      {next.length > 0 ? (
        <section className={styles.next} aria-labelledby="next-title">
          <h2 id="next-title" className={styles.nextTitle}>
            Les prochains matchs
          </h2>
          {next.map((m) => (
            <MatchCard key={m.id} match={m} {...cardProps} />
          ))}
        </section>
      ) : null}

      {loaded && basket.length > 0 ? (
        <div className={styles.bar} role="region" aria-label="Mes pronos">
          <span className={styles.barCount}>
            {basket.length} {basket.length > 1 ? "pronos prêts" : "prono prêt"}
          </span>
          <Link href={saveHref} className={styles.barButton} onClick={() => trackFunnel("save_opened")}>
            Enregistrer
          </Link>
        </div>
      ) : null}
    </>
  );
}

type CardProps = {
  match: HomeMatch;
  big?: boolean;
  basket: BasketItem[];
  draft: Draft | null;
  splits: Record<string, Split>;
  now: number | null;
  onPick: (match: HomeMatch, team: HomeTeam) => void;
  onMargin: (match: HomeMatch, margin: number) => void;
  onCancel: (matchId: string) => void;
};

function MatchCard({ match, big = false, basket, draft, splits, onPick, onMargin, onCancel }: CardProps) {
  const saved = basket.find((i) => i.matchId === match.id) ?? null;
  const drafting = draft?.matchId === match.id ? draft : null;
  const chosenTeamId = drafting?.winnerTeamId ?? saved?.winnerTeamId ?? null;
  const teams = [match.home, match.away];
  const savedTeam = saved ? teams.find((t) => t.id === saved.winnerTeamId) : null;
  const split = splits[match.id];

  return (
    <article className={`${styles.card} ${big ? styles.cardBig : ""} glass-card`}>
      <div className={styles.teams} role="group" aria-label={`${match.home.name} contre ${match.away.name}`}>
        {teams.map((team) => (
          <button
            key={team.id}
            type="button"
            className={`${styles.team} ${chosenTeamId === team.id ? styles.teamChosen : ""}`}
            aria-pressed={chosenTeamId === team.id}
            onClick={() => onPick(match, team)}
          >
            <TeamLogo abbreviation={team.abbreviation} alt="" size={big ? 56 : 40} />
            <span className={styles.teamName}>{team.name}</span>
          </button>
        ))}
      </div>

      {drafting ? (
        <MarginPanel
          match={match}
          draft={drafting}
          onMargin={(margin) => onMargin(match, margin)}
        />
      ) : saved && savedTeam ? (
        <p className={styles.saved}>
          <span>
            ✓ {savedTeam.name} +{saved.margin}
          </span>
          <button type="button" className={styles.linkButton} onClick={() => onPick(match, savedTeam)}>
            modifier
          </button>
          <button type="button" className={styles.linkButton} onClick={() => onCancel(match.id)}>
            retirer
          </button>
        </p>
      ) : null}

      {chosenTeamId ? (
        split ? (
          <div className={styles.split}>
            <p className={styles.splitText}>
              <strong>{split.total} joueurs</strong> ont déjà pronostiqué
            </p>
            <div
              className={styles.splitBar}
              role="img"
              aria-label={`${split.homePercent} % ${match.home.name}, ${split.awayPercent} % ${match.away.name}`}
            >
              <span className={styles.splitHome} style={{ width: `${split.homePercent}%` }} />
            </div>
            <p className={styles.splitLegend}>
              <span>
                {split.homePercent} % {match.home.abbreviation}
              </span>
              <span>
                {split.awayPercent} % {match.away.abbreviation}
              </span>
            </p>
          </div>
        ) : (
          <p className={styles.splitText}>Sois parmi les premiers à pronostiquer ce match.</p>
        )
      ) : null}
    </article>
  );
}

function MarginPanel({
  match,
  draft,
  onMargin,
}: {
  match: HomeMatch;
  draft: Draft;
  onMargin: (margin: number) => void;
}) {
  const winner = draft.winnerTeamId === match.home.id ? match.home : match.away;
  const sliderId = `margin-${match.id}`;
  return (
    <div className={styles.margin}>
      <label htmlFor={sliderId} className={styles.marginLabel}>
        De combien de points ?
      </label>
      <p className={styles.marginPhrase} aria-live="polite">
        <strong>{winner.name}</strong> gagne de <strong className={styles.marginValue}>{draft.margin}</strong> point
        {draft.margin > 1 ? "s" : ""}
      </p>
      <input
        id={sliderId}
        type="range"
        min={MARGIN_MIN}
        max={MARGIN_MAX}
        step={1}
        value={draft.margin}
        className={styles.slider}
        onChange={(e) => onMargin(Number(e.target.value))}
      />
      <p className={styles.rulesHint}>
        <Link href="/regles">Voir le barème</Link>
      </p>
    </div>
  );
}
