import type { LiveScore, MatchDay } from "@/lib/queries/play";
import styles from "./LiveTicker.module.css";

// Ticker "en direct" de Jouer/Mes pronos — chantier À L'ESSAI, réversible
// (AJUSTEMENTS_VISUELS_20_08_2026 §16) : testé en conditions réelles plutôt
// que débattu plus longtemps (Bracket = lecture pure, Jouer = surtout de
// l'action ; les deux arguments cohérence/distraction se valaient à la
// discussion). Recompose ce qui est affiché sur cette page ou dans Résultats (scores des matchs en direct + prochain
// match encore à pronostiquer) — composant serveur, pas de fetch propre.
//
// Réversibilité : rien ailleurs dans le code ne dépend de ce composant.
// Pour retirer l'essai, supprimer ce fichier + LiveTicker.module.css et son
// import dans app/(app)/play/page.tsx.

type TickerItem =
  | { kind: "score"; key: string; live: boolean; home: string; away: string; score: string }
  | { kind: "deadline"; key: string; matchup: string; when: string }
  | { kind: "promo"; key: string; tag: string; text: string };

// Compte à rebours NBA Cup (demande du 21/11/2026) : tant que la date n'est
// pas passée, le bandeau n'affiche QUE ce message ; ensuite il revient seul
// aux scores en direct + prochain match. Date donnée « de mémoire » par
// l'utilisateur (phases finales) : à corriger ici si elle bouge.
const NBA_CUP_CHALLENGE_DATE = "2026-12-04"; // jour calendaire, heure de Paris

const PARIS_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Jours calendaires (heure de Paris) avant le challenge ; négatif une fois passé. */
function daysUntilCupChallenge(now: Date): number {
  const today = Date.parse(`${PARIS_DAY_FORMATTER.format(now)}T00:00:00Z`);
  const target = Date.parse(`${NBA_CUP_CHALLENGE_DATE}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

function cupCountdownText(days: number): string {
  if (days === 0) return "NBA Cup challenge aujourd'hui, prépare-toi à gagner";
  if (days === 1) return "NBA Cup challenge demain, prépare-toi à gagner";
  return `NBA Cup challenge dans ${days} jours, prépare-toi à gagner`;
}

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type LiveTickerProps = {
  liveScores: LiveScore[];
  days: MatchDay[];
};

export function LiveTicker({ liveScores, days }: LiveTickerProps) {
  const daysToCup = daysUntilCupChallenge(new Date());
  if (daysToCup >= 0) {
    return renderTicker([{ kind: "promo", key: "nba-cup", tag: "NBA Cup", text: cupCountdownText(daysToCup) }]);
  }

  const scoreItems: TickerItem[] = liveScores.map((row) => ({
    kind: "score",
    key: row.matchId,
    live: true,
    home: row.home,
    away: row.away,
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
          // Match du jour : jour NY de la carte (« Match du 05/11 »), pas la
          // date de Paris qui tombe le lendemain pour un coup d'envoi de nuit.
          when: nextToPredict.daily
            ? `${nextToPredict.daily.dayLabel.replace(/^Match du /, "")} ${nextToPredict.daily.time}`
            : TIME_FORMATTER.format(new Date(nextToPredict.scheduledAt)),
        },
      ]
    : [];

  const items = [...scoreItems, ...deadlineItem];
  if (items.length === 0) return null;
  return renderTicker(items);
}

function renderTicker(items: TickerItem[]) {
  function renderItems(groupKey: string) {
    return items.map((item) =>
      item.kind === "promo" ? (
        <span key={`${groupKey}-${item.key}`} className={styles.item}>
          <span className={styles.deadlineTag}>{item.tag}</span>
          <span className={styles.deadlineMeta}>{item.text}</span>
        </span>
      ) : item.kind === "score" ? (
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
    // (Résultats pour les scores, MatchDayGroup pour le prochain match) —
    // décoratif, pas de 2e annonce pour les lecteurs d'écran.
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.track}>
        <div className={styles.trackGroup}>{renderItems("a")}</div>
        <div className={`${styles.trackGroup} ${styles.trackGroupDuplicate}`}>{renderItems("b")}</div>
      </div>
    </div>
  );
}
