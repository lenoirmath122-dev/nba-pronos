import type { WeeklyPalmaresData } from "@/lib/queries/weeklyPalmares";
import { formatWeekEndLabel } from "@/lib/weekly/palmares";
import styles from "./WeeklyPalmares.module.css";

// Contenu du palmarès hebdo (lot 4 du classement hebdo) : total + une ligne par
// semaine gagnée. Contenu seul, chaque page l'enveloppe à sa manière (carte
// repliable sur le profil propre, section sur /players). Composant serveur.
//
// Ce n'est pas un badge : la comparaison entre joueurs reste hors des badges
// permanents (BACKLOG_V1, section « Fun / esprit ligue entre potes »).

export function WeeklyPalmares({
  data,
  variant,
}: {
  data: WeeklyPalmaresData;
  /** "self" : états vide et erreur expliqués. "other" : rien à dire sur la
   *  page de quelqu'un d'autre, la section est masquée par l'appelant via
   *  hasWeeklyPalmaresToShow. */
  variant: "self" | "other";
}) {
  if (data.state === "error") {
    return variant === "self" ? <p className={styles.muted}>Palmarès indisponible pour le moment.</p> : null;
  }
  if (data.total === 0) {
    return variant === "self" ? <p className={styles.muted}>Aucune semaine gagnée pour l&rsquo;instant.</p> : null;
  }

  return (
    <div className={styles.palmares}>
      <p className={styles.total}>
        <span className={styles.totalValue}>{data.total}</span>{" "}
        {data.total > 1 ? "semaines gagnées" : "semaine gagnée"}
      </p>
      <ul className={styles.list}>
        {data.weeks.map((week) => (
          <li key={`${week.competitionId}|${week.weekEndDate}`} className={styles.row}>
            <span className={styles.rowMain}>
              <time dateTime={week.weekEndDate} className={styles.date}>
                Semaine finie le {formatWeekEndLabel(week.weekEndDate)}
              </time>
              <span className={styles.competition}>{week.competitionName}</span>
            </span>
            <span className={styles.rowAside}>
              {week.isCoChampion && <span className={styles.coChampion}>Co-champion</span>}
              <span className={styles.points}>{week.points} pts</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sur la page d'un autre joueur, la section entière est masquée s'il n'y a
 *  rien de positif à montrer (aucune victoire, ou lecture en erreur). */
export function hasWeeklyPalmaresToShow(data: WeeklyPalmaresData): boolean {
  return data.state === "ok" && data.total > 0;
}
