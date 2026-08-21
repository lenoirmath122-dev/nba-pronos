import type { PendingValidationBet } from "@/lib/queries/admin-validation";
import { BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS } from "@/lib/labels/bets";
import { validateBetFormAction, rejectBetFormAction } from "@/lib/actions/admin-validation";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { STAT_LABELS_FR, PERCENTAGE_STATS, NO_THRESHOLD_STATS, type StatCode } from "@/lib/ai/statCodes";
import styles from "./ValidationBetCard.module.css";

// Résumé lisible de la structuration IA (Phase 5 Data NBA, 21/08/2026) --
// simple SUGGESTION, l'admin garde la main (select ci-dessous pré-rempli
// mais modifiable, même patron que proposedCategory/proposedDifficulty).
function aiSuggestionLabel(bet: PendingValidationBet): string | null {
  if (!bet.isCalculable || !bet.structuredStat || bet.calculatedProba === null) return null;
  const stat = bet.structuredStat as StatCode;
  const label = STAT_LABELS_FR[stat] ?? bet.structuredStat;
  const comparisonLabel = bet.structuredComparison === "UNDER" ? "moins de" : "plus de";
  const thresholdLabel = NO_THRESHOLD_STATS.has(stat)
    ? ""
    : ` ${comparisonLabel} ${PERCENTAGE_STATS.has(stat) ? `${Math.round((bet.structuredThreshold ?? 0) * 100)}%` : bet.structuredThreshold}`;
  return `Suggestion IA : ${bet.structuredPlayerName ?? "?"} — ${label}${thresholdLabel} (proba calculée ${Math.round(bet.calculatedProba * 100)}%, palier ${bet.suggestedDifficulty} suggéré)`;
}

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
      {aiSuggestionLabel(bet) && <p className={styles.aiSuggestion}>{aiSuggestionLabel(bet)}</p>}

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
          <select name="validatedDifficulty" defaultValue={bet.suggestedDifficulty ?? bet.proposedDifficulty} className={styles.select}>
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
