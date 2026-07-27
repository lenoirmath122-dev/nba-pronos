import { TeamLogo } from "@/components/ui/TeamLogo";
import type { TeamOption } from "@/lib/queries/profile";
import styles from "./TeamPicker.module.css";

// Sélecteur d'équipe favorite (SPEC_ECRAN_PROFIL_V0_1 §3/§10) : liste de
// vrais <input type="radio">, PAS de <select> natif (ne peut pas afficher de
// logo, piège déjà rencontré §2.15 ETAT_ACTUEL.md) — mais contrairement aux
// sélecteurs de BetForm.tsx, ce picker n'a AUCUNE dépendance entre champs à
// gérer en direct : de vrais radios natifs suffisent, zéro "use client" pour
// ce composant (le surlignage de la ligne sélectionnée est purement CSS,
// :has()).

type TeamPickerProps = {
  teams: TeamOption[];
  selectedTeamId: string | null;
};

export function TeamPicker({ teams, selectedTeamId }: TeamPickerProps) {
  return (
    <div className={styles.list} role="radiogroup" aria-label="Équipe favorite">
      <label className={styles.item}>
        <input
          type="radio"
          name="favoriteTeamId"
          value=""
          defaultChecked={selectedTeamId === null}
          className={styles.radio}
        />
        <span className={styles.itemLabel}>Aucune</span>
      </label>
      {teams.map((team) => (
        <label key={team.teamId} className={styles.item}>
          <input
            type="radio"
            name="favoriteTeamId"
            value={team.teamId}
            defaultChecked={team.teamId === selectedTeamId}
            className={styles.radio}
          />
          <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={28} />
          <span className={styles.itemLabel}>{team.name}</span>
        </label>
      ))}
    </div>
  );
}
