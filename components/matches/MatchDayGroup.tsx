import type { MatchDay } from "@/lib/queries/matches";
import { MatchRow } from "./MatchRow";
import styles from "./MatchDayGroup.module.css";

// Regroupement par jour (§2/§3) — composant SERVEUR : ne porte aucun état,
// se contente de rendre les MatchRow (client) qui gèrent chacune leur propre
// ouverture. La page et ce composant restent serveur (§1).
type MatchDayGroupProps = { day: MatchDay };

export function MatchDayGroup({ day }: MatchDayGroupProps) {
  return (
    <section className={styles.day} aria-label={day.label}>
      <h3 className={styles.dayLabel}>{day.label}</h3>
      <div className={styles.matches}>
        {day.matches.map((match) => (
          <MatchRow key={match.matchId} match={match} />
        ))}
      </div>
    </section>
  );
}
