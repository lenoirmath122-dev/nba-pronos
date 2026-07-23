import { useState } from "react";
import styles from "./MarginStepper.module.css";

// Stepper d'écart (§6, acté 23/07/2026) — sans directive "use client" propre :
// rendu exclusivement par PredictionForm, mais il porte son propre état local
// (bascule affichage/saisie libre), ce qui est permis pour un composant
// transitivement bundlé côté client (même mécanisme que NodeCard/RotateInvite).
//
// Règles non négociables : case VIDE au départ (jamais 0, jamais pré-rempli) ;
// "−" inactif tant que vide OU à 1 ; "+" sur case vide pose 1 ; tap sur la
// valeur (vide ou non) ouvre la saisie libre — implémentée ici via un <input
// type="number" inputMode="numeric">, qui déclenche le pavé numérique natif
// sur mobile (interprétation du "pavé numérique" de la spec : pas de grille
// de touches maison, le clavier système suffit et reste accessible).
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
    <div className={styles.stepper}>
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
}
