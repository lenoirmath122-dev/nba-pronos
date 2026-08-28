import type { MatchDay } from "@/lib/queries/play";
import { MatchDayGroup } from "./MatchDayGroup";
import styles from "./BeyondWindowSection.module.css";

type BeyondWindowSectionProps = { days: MatchDay[] };

// Matchs au-delà de la fenêtre glissante de 3 jours de l'écran "Matchs" --
// repli replié par défaut plutôt qu'affiché en continu (28/08/2026, demande
// explicite de l'utilisateur, alternative à une fenêtre plus large
// spécifique à NBA_CUP). <details>/<summary> natif, même patron que
// ValidationBetCard.tsx -- s'ouvre/se ferme sans handler dédié. Composant
// SERVEUR comme MatchDayGroup, aucun état à porter côté client.
export function BeyondWindowSection({ days }: BeyondWindowSectionProps) {
  const count = days.reduce((sum, day) => sum + day.matches.length, 0);
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>Dans plus de 3 jours ({count})</summary>
      <div className={styles.list}>
        {days.map((day) => (
          <MatchDayGroup key={day.key} day={day} />
        ))}
      </div>
    </details>
  );
}
