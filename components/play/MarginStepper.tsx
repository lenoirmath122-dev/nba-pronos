import { useState } from "react";
import styles from "./MarginStepper.module.css";

// Stepper d'écart (§6, acté 23/07/2026 ; revu le 02/08/2026, puis relogé le
// 14/09/2026 à côté du nom de l'équipe sélectionnée dans l'en-tête —
// remplace la grille 2 colonnes qui vivait sous les boutons logo). Ce
// composant ne rend plus que les contrôles bruts pour l'équipe déjà choisie
// comme vainqueur : c'est UpcomingRow (qui possède désormais aussi l'état
// `margin`, comme `winner`) qui décide QUAND et À CÔTÉ DE QUELLE équipe les
// afficher — sans directive "use client" propre, toujours rendu via un
// ancêtre "use client" (UpcomingRow), même mécanisme que NodeCard.
//
// Règles non négociables inchangées : case VIDE au départ (jamais 0, jamais
// pré-rempli) ; "+" sur case vide pose 1 ; tap sur la valeur ouvre la saisie
// libre (pavé numérique natif, <input type="number" inputMode="numeric">).
type MarginStepperProps = {
  value: number | null;
  onChange: (next: number | null) => void;
};

export function MarginStepper({ value, onChange }: MarginStepperProps) {
  const [isEditing, setIsEditing] = useState(false);

  const minusDisabled = value === null || value <= 1;
  const plusDisabled = value !== null && value >= 50;

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 50) {
      onChange(parsed);
    }
    setIsEditing(false);
  }

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.btn}
        disabled={minusDisabled}
        onClick={() => value !== null && onChange(value - 1)}
        aria-label="Diminuer l'écart"
      >
        −
      </button>

      {isEditing ? (
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          className={styles.input}
          defaultValue={value ?? ""}
          // le bouton se transforme en champ suite à un clic explicite ;
          // sans autoFocus l'utilisateur devrait re-cliquer pour taper.
          // eslint-disable-next-line jsx-a11y/no-autofocus
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
          {/* "+" pas "−" (même convention que le badge de statut,
              UpcomingRow.tsx) : cette valeur est toujours l'écart de
              victoire de l'équipe déjà choisie, jamais un score brut. */}
          <span className={styles.valueText}>{value !== null ? `+${value}` : ""}</span>
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
}
