import type { TeamRef } from "@/lib/queries/matches";
import { TeamLogo } from "@/components/ui/TeamLogo";
import styles from "./TeamPicker.module.css";

// Sélecteur de vainqueur par tap direct sur l'équipe (T7 §15.8) — pas de
// boutons segmentés séparés. Sans "use client" : rendu exclusivement par
// PredictionForm (même mécanisme que TeamLabel/NodeCard du bracket).
type TeamPickerProps = {
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
};

export function TeamPicker({ homeTeam, awayTeam, selectedTeamId, onSelect }: TeamPickerProps) {
  return (
    <div className={styles.picker}>
      {[homeTeam, awayTeam].map((team) => {
        const isSelected = selectedTeamId === team.id;
        return (
          <button
            key={team.id}
            type="button"
            className={isSelected ? `${styles.team} ${styles.teamSelected}` : styles.team}
            onClick={() => onSelect(team.id)}
            aria-pressed={isSelected}
          >
            <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={32} />
            <span className={styles.abbrev}>{team.abbreviation}</span>
            <span className={styles.name}>{team.name}</span>
          </button>
        );
      })}
    </div>
  );
}
