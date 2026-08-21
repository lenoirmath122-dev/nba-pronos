import type { PendingValidationBet } from "@/lib/queries/admin-validation";
import { BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS } from "@/lib/labels/bets";
import { validateBetFormAction, rejectBetFormAction } from "@/lib/actions/admin-validation";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./ValidationBetCard.module.css";

// Note (Phase 5 Data NBA, 21/08/2026) : un pari `is_calculable` par l'IA
// n'apparaît plus jamais dans cette file -- update_bet_structuration le
// fait sauter direct en VALIDATED (auto-validation, voir
// AutoValidatedBetCard.tsx pour la correction admin après coup). Un pari
// ici a donc toujours `isCalculable: false`, la suggestion IA affichée
// pendant la 1re version de cette fonctionnalité (avant l'auto-validation)
// a été retirée -- devenue du code mort par construction.

// Une carte de la file de validation (SPEC_ECRAN_ADMIN_VALIDATION_V0_1 §2) :
// contexte complet sans navigation + 2 formulaires natifs indépendants
// (Valider / Refuser), même patron que MyBetRow (Mes paris) — pas de
// "use client", les <select> fonctionnent nativement sans JS.

type ValidationBetCardProps = {
  bet: PendingValidationBet;
  error?: string;
};

export function ValidationBetCard({ bet, error }: ValidationBetCardProps) {
  return (
    <li className={styles.card}>
      <p className={styles.player}>
        <PlayerLink userId={bet.playerUserId} pseudo={bet.playerPseudo} />
      </p>
      <p className={styles.target}>{bet.targetLabel}</p>
      <p className={styles.description}>{bet.description}</p>

      {error && <p className={styles.error}>{error}</p>}

      <form action={validateBetFormAction} className={styles.validateForm}>
        <input type="hidden" name="betId" value={bet.betId} />

        <label className={styles.field}>
          Catégorie
          <select name="validatedCategory" defaultValue={bet.proposedCategory} className={styles.select}>
            {BET_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          Difficulté
          <select name="validatedDifficulty" defaultValue={bet.proposedDifficulty} className={styles.select}>
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <option key={level} value={level}>
                {level} — {BET_DIFFICULTY_LABELS[level]}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={styles.validateButton}>
          Valider
        </button>
      </form>

      <details className={styles.details}>
        <summary className={styles.summary}>Refuser</summary>
        <form action={rejectBetFormAction} className={styles.rejectForm}>
          <input type="hidden" name="betId" value={bet.betId} />
          <label className={styles.field}>
            Motif du refus
            <textarea name="refusalReason" required rows={2} className={styles.textarea} />
          </label>
          <button type="submit" className={styles.rejectButton}>
            Confirmer le refus
          </button>
        </form>
      </details>
    </li>
  );
}
