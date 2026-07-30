import type { PendingResolutionBet } from "@/lib/queries/admin-resolution";
import { BET_CATEGORY_OPTIONS, BET_DIFFICULTY_LABELS } from "@/lib/labels/bets";
import { resolveBetFormAction } from "@/lib/actions/admin-resolution";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./ResolutionBetCard.module.css";

// Une carte de la file de résolution (SPEC_ECRAN_ADMIN_RESOLUTION_V0_1 §2) :
// contexte complet sans navigation + UN formulaire natif à 2 boutons submit
// (Gagné/Perdu, name="outcome"), aucun "use client".

const CATEGORY_LABEL = Object.fromEntries(BET_CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<
  PendingResolutionBet["validatedCategory"],
  string
>;

type ResolutionBetCardProps = {
  bet: PendingResolutionBet;
  error?: string;
};

export function ResolutionBetCard({ bet, error }: ResolutionBetCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <p className={styles.player}>
          <PlayerLink userId={bet.playerUserId} pseudo={bet.playerPseudo} />
        </p>
        {bet.isContested && <span className={styles.contestedBadge}>Contesté</span>}
      </div>
      <p className={styles.target}>{bet.targetLabel}</p>
      <p className={styles.description}>{bet.description}</p>
      <p className={styles.meta}>
        {CATEGORY_LABEL[bet.validatedCategory]} · {BET_DIFFICULTY_LABELS[bet.validatedDifficulty]}
      </p>
      <p className={styles.pointsAtStake}>{bet.pointsAtStake} points en jeu</p>

      {error && <p className={styles.error}>{error}</p>}

      <form action={resolveBetFormAction} className={styles.form}>
        <input type="hidden" name="betId" value={bet.betId} />

        <label className={styles.field}>
          Motif{bet.isContested ? " (obligatoire, pari contesté)" : " (recommandé)"}
          <textarea name="resolutionReason" required={bet.isContested} rows={2} className={styles.textarea} />
        </label>

        <div className={styles.actions}>
          <button type="submit" name="outcome" value="WON" className={styles.wonButton}>
            Gagné
          </button>
          <button type="submit" name="outcome" value="LOST" className={styles.lostButton}>
            Perdu
          </button>
        </div>
      </form>
    </li>
  );
}
