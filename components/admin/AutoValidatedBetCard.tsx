import type { AutoValidatedBet } from "@/lib/queries/admin-validation";
import { BET_DIFFICULTY_LABELS } from "@/lib/labels/bets";
import { overrideAutoValidatedDifficultyFormAction } from "@/lib/actions/admin-validation";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { STAT_LABELS_FR, PERCENTAGE_STATS, NO_THRESHOLD_STATS, type StatCode } from "@/lib/ai/statCodes";
import styles from "./AutoValidatedBetCard.module.css";

// Paris auto-validés par l'IA (Phase 5 Data NBA, 21/08/2026) -- jamais
// passés par la file de validation admin classique (ValidationBetCard.tsx),
// listés ici pour la seule action qui reste possible : corriger la
// difficulté après coup (décidé avec l'utilisateur, aucun mécanisme de
// correction existant ne couvrait ce cas, voir lib/actions/admin-validation.ts).

function structuredLabel(bet: AutoValidatedBet): string {
  if (!bet.structuredStat) return "";
  const stat = bet.structuredStat as StatCode;
  const label = STAT_LABELS_FR[stat] ?? bet.structuredStat;
  if (NO_THRESHOLD_STATS.has(stat)) return `${bet.structuredPlayerName ?? "?"} — ${label}`;
  const comparisonLabel = bet.structuredComparison === "UNDER" ? "moins de" : "plus de";
  const thresholdLabel = PERCENTAGE_STATS.has(stat) ? `${Math.round((bet.structuredThreshold ?? 0) * 100)}%` : bet.structuredThreshold;
  return `${bet.structuredPlayerName ?? "?"} — ${label} ${comparisonLabel} ${thresholdLabel}`;
}

type AutoValidatedBetCardProps = {
  bet: AutoValidatedBet;
  error?: string;
};

export function AutoValidatedBetCard({ bet, error }: AutoValidatedBetCardProps) {
  return (
    <li className={styles.card}>
      <p className={styles.player}>
        <PlayerLink userId={bet.playerUserId} pseudo={bet.playerPseudo} />
      </p>
      <p className={styles.target}>{bet.targetLabel}</p>
      <p className={styles.description}>{bet.description}</p>
      <p className={styles.aiSummary}>
        {structuredLabel(bet)} — proba calculée {Math.round(bet.calculatedProba * 100)}%
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <form action={overrideAutoValidatedDifficultyFormAction} className={styles.form}>
        <input type="hidden" name="betId" value={bet.betId} />
        <label className={styles.field}>
          Difficulté (auto-validée par l&apos;IA)
          <select name="newDifficulty" defaultValue={bet.currentDifficulty} className={styles.select}>
            {([1, 2, 3, 4, 5] as const).map((level) => (
              <option key={level} value={level}>
                {level} — {BET_DIFFICULTY_LABELS[level]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.submitButton}>
          Corriger
        </button>
      </form>
    </li>
  );
}
