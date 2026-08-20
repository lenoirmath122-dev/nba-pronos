import type { LockedMatchRow, MatchDay } from "@/lib/queries/play";
import styles from "./LiveTicker.module.css";

// Ticker "en direct" de Jouer/Mes pronos — chantier À L'ESSAI, réversible
// (AJUSTEMENTS_VISUELS_20_08_2026 §16) : testé en conditions réelles plutôt
// que débattu plus longtemps (Bracket = lecture pure, Jouer = surtout de
// l'action ; les deux arguments cohérence/distraction se valaient à la
// discussion). AUCUNE donnée nouvelle : recompose seulement ce qui est déjà
// affiché sur cette page (scores des matchs récemment verrouillés + prochain
// match encore à pronostiquer) — composant serveur, pas de fetch propre.
//
// Réversibilité : rien ailleurs dans le code ne dépend de ce composant.
// Pour retirer l'essai, supprimer ce fichier + LiveTicker.module.css et son
// import dans app/(app)/play/page.tsx.

type TickerItem =
  | { kind: "score"; key: string; live: boolean; home: string; away: string; score: string }
  | { kind: "deadline"; key: string; matchup: string; when: string };

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type LiveTickerProps = {
  recentLocked: LockedMatchRow[];
  days: MatchDay[];
};

export function LiveTicker({ recentLocked, days }: LiveTickerProps) {
  const scoreItems: TickerItem[] = recentLocked
    .filter((row) => row.liveState === "LIVE" || row.liveState === "FINISHED")
    .map((row) => ({
      kind: "score",
      key: row.matchId,
      live: row.liveState === "LIVE",
      home: row.home.abbreviation,
      away: row.away.abbreviation,
      score: row.homeScore !== null && row.awayScore !== null ? `${row.homeScore}–${row.awayScore}` : "—",
    }));

  // "À pronostiquer" = pas encore VALIDATED (TODO/INCOMPLETE/READY comptent
  // toujours comme une action restante) — même sens que "Reste à faire" sur
  // l'Accueil, appliqué au 1er match chronologique.
  const nextToPredict = days
    .flatMap((day) => day.matches)
    .filter((match) => match.viewStatus !== "VALIDATED")
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))[0];

  const deadlineItem: TickerItem[] = nextToPredict
    ? [
        {
          kind: "deadline",
          key: nextToPredict.matchId,
          matchup: `${nextToPredict.homeTeam.abbreviation} – ${nextToPredict.awayTeam.abbreviation}`,
          when: TIME_FORMATTER.format(new Date(nextToPredict.scheduledAt)),
        },
      ]
    : [];

  const items = [...scoreItems, ...deadlineItem];
  if (items.length === 0) return null;

  function renderItems(groupKey: string) {
    return items.map((item) =>
      item.kind === "score" ? (
        <span key={`${groupKey}-${item.key}`} className={styles.item}>
          {item.live && <span className={styles.liveTag}>En direct</span>}
          <span className={styles.score}>
            {item.home} {item.score} {item.away}
          </span>
        </span>
      ) : (
        <span key={`${groupKey}-${item.key}`} className={styles.item}>
          <span className={styles.deadlineTag}>Prochain à pronostiquer</span>
          <span className={styles.deadlineMeta}>
            {item.matchup} · {item.when}
          </span>
        </span>
      )
    );
  }

  return (
    // Restitue uniquement du contenu déjà accessible ailleurs sur cette page
    // (LockedRow pour les scores, MatchDayGroup pour le prochain match) —
    // décoratif, pas de 2e annonce pour les lecteurs d'écran.
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.track}>
        <div className={styles.trackGroup}>{renderItems("a")}</div>
        <div className={`${styles.trackGroup} ${styles.trackGroupDuplicate}`}>{renderItems("b")}</div>
      </div>
    </div>
  );
}
