import type { MatchDay } from "@/lib/queries/play";
import { UpcomingRow } from "./UpcomingRow";
import styles from "./MatchDayGroup.module.css";

// Regroupement par jour — composant SERVEUR : ne porte aucun état, se
// contente de rendre les UpcomingRow (client) qui gèrent chacune leur propre
// ouverture. Ex-components/matches/MatchDayGroup.tsx.
type MatchDayGroupProps = { day: MatchDay; maxBetPoints: number };

export function MatchDayGroup({ day, maxBetPoints }: MatchDayGroupProps) {
  return (
    <section className={styles.day} aria-label={day.label}>
      <h3 className={styles.dayLabel}>{day.label}</h3>
      <div className={styles.matches}>
        {day.matches.map((match) => (
          <UpcomingRow key={match.matchId} match={match} maxBetPoints={maxBetPoints} />
        ))}
      </div>
    </section>
  );
}
