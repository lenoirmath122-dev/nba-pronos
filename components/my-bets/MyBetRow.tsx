import Link from "next/link";
import { requestBetCorrectionFormAction } from "@/lib/actions/bet-corrections";
import type { MyBet } from "@/lib/queries/my-bets";
import { BET_CATEGORY_OPTIONS } from "@/lib/labels/bets";
import styles from "./MyBetRow.module.css";

// Une ligne de l'écran Mes paris (SPEC_ECRAN_MES_PARIS_V0_1 §3/§5). Même
// convention de statut qu'AssociatedBetCard (Mes pronos) — labels/couleurs
// identiques, pas une 2e convention divergente pour le même statut.

const STATUS_LABEL: Record<MyBet["status"], string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  VALIDATED: "Validé",
  REJECTED: "Refusé",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELLED: "Neutralisé",
};

const STATUS_CLASS: Record<MyBet["status"], string> = {
  DRAFT: styles.statusNeutral,
  SUBMITTED: styles.statusNeutral,
  VALIDATED: styles.statusNeutral,
  REJECTED: styles.statusMuted,
  WON: styles.statusWon,
  LOST: styles.statusLost,
  CANCELLED: styles.statusCancelled,
};

const CATEGORY_LABEL = Object.fromEntries(BET_CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<
  MyBet["category"],
  string
>;

type MyBetRowProps = {
  bet: MyBet;
  forceOpenCorrection: boolean;
  correctionError?: string;
};

export function MyBetRow({ bet, forceOpenCorrection, correctionError }: MyBetRowProps) {
  const isCancelled = bet.status === "CANCELLED";
  const isEditable = bet.status === "DRAFT" || bet.status === "SUBMITTED";

  return (
    <div className={styles.row}>
      <p className={styles.target}>{bet.targetLabel}</p>
      <p className={isCancelled ? `${styles.description} ${styles.descriptionCancelled}` : styles.description}>
        {bet.description}
      </p>
      <span className={styles.meta}>
        {CATEGORY_LABEL[bet.category]} · difficulté {bet.difficulty}
        {!bet.isDifficultyValidated && " (proposée)"}
      </span>
      <span className={`${styles.status} ${STATUS_CLASS[bet.status]}`}>{STATUS_LABEL[bet.status]}</span>
      {bet.pointsAwarded !== null && <span className={styles.points}>{bet.pointsAwarded} pts</span>}

      {bet.status === "REJECTED" && bet.refusalReason && <p className={styles.reason}>Motif du refus : {bet.refusalReason}</p>}
      {(bet.status === "WON" || bet.status === "LOST") && bet.resolutionReason && (
        <p className={styles.reason}>{bet.resolutionReason}</p>
      )}
      {bet.isAdminCorrected && <span className={styles.correctedBadge}>Corrigé par un admin</span>}

      {isEditable && (
        <Link href={`/play/bets/${bet.betId}/edit`} className={styles.editLink}>
          Modifier
        </Link>
      )}

      {bet.isForgottenResolution && (
        <BetCorrectionForm
          betId={bet.betId}
          hasPendingRequest={bet.hasPendingCorrectionRequest}
          forceOpen={forceOpenCorrection}
          error={correctionError}
        />
      )}
    </div>
  );
}

type BetCorrectionFormProps = {
  betId: string;
  hasPendingRequest: boolean;
  forceOpen: boolean;
  error?: string;
};

function BetCorrectionForm({ betId, hasPendingRequest, forceOpen, error }: BetCorrectionFormProps) {
  // Une requête PENDING bloque déjà côté base (migration #11) — on évite ici
  // de proposer un second dépôt qui échouerait forcément (même patron que
  // CorrectionRequestForm, Mes pronos).
  if (hasPendingRequest) {
    return <p className={styles.pending}>Requête en attente.</p>;
  }

  return (
    <details className={styles.details} open={forceOpen}>
      <summary className={styles.summary}>Signaler à un admin</summary>

      {error && <p className={styles.error}>{error}</p>}

      <form action={requestBetCorrectionFormAction} className={styles.form}>
        <input type="hidden" name="betId" value={betId} />
        <label className={styles.field}>
          Motif
          <textarea name="justification" required rows={2} className={styles.textarea} />
        </label>
        <button type="submit" className={styles.submit}>
          Envoyer
        </button>
      </form>
    </details>
  );
}
