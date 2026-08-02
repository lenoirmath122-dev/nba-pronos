import { useState } from "react";
import styles from "./MarginStepper.module.css";

// Stepper d'écart (§6, acté 23/07/2026 ; revu le 02/08/2026 à la demande de
// l'utilisateur) — sans directive "use client" propre : rendu exclusivement
// par PredictionForm, même mécanisme que NodeCard/RotateInvite.
//
// "+" positionné sous l'équipe déjà choisie comme vainqueur par TeamPicker
// (2 colonnes alignées sur celles de TeamPicker) — plus de bouton "−" ni de
// stepper flottant séparé, sur demande explicite de l'utilisateur.
//
// Règles non négociables inchangées : case VIDE au départ (jamais 0, jamais
// pré-rempli) ; rien ne s'affiche tant qu'aucun vainqueur n'est choisi ; "+"
// sur case vide pose 1 ; tap sur la valeur ouvre la saisie libre (pavé
// numérique natif, <input type="number" inputMode="numeric">).
type MarginStepperProps = {
  value: number | null;
  onChange: (next: number | null) => void;
  winnerTeamId: string | null;
  homeTeamId: string;
  awayTeamId: string;
};

export function MarginStepper({ value, onChange, winnerTeamId, homeTeamId, awayTeamId }: MarginStepperProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (winnerTeamId === null) return null;

  const plusDisabled = value !== null && value >= 50;

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 50) {
      onChange(parsed);
    }
    setIsEditing(false);
  }

  const controls = (
    <div className={styles.controls}>
      {isEditing ? (
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          className={styles.input}
          defaultValue={value ?? ""}
          autoFocus
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit((event.target as HTMLInputElement).value);
            if (event.key === "Escape") setIsEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          className={styles.value}
          onClick={() => setIsEditing(true)}
          aria-label="Saisir l'écart au pavé numérique"
        >
          <span className={styles.valueText}>{value ?? ""}</span>
        </button>
      )}

      <button
        type="button"
        className={styles.btn}
        disabled={plusDisabled}
        onClick={() => onChange(value === null ? 1 : Math.min(50, value + 1))}
        aria-label="Augmenter l'écart"
      >
        +
      </button>
    </div>
  );

  return (
    <div className={styles.stepper}>
      <div className={styles.slot}>{winnerTeamId === homeTeamId && controls}</div>
      <div className={styles.slot}>{winnerTeamId === awayTeamId && controls}</div>
    </div>
  );
}
