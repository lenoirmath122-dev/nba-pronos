import Link from "next/link";
import type { PlayAssociatedBet } from "@/lib/queries/play";
import { BET_CATEGORY_OPTIONS } from "@/lib/labels/bets";
import { requestBetCorrectionFormAction } from "@/lib/actions/bet-corrections";
import styles from "./BetBlock.module.css";

// Rendu LECTURE SEULE d'un pari associé — fusion de l'ex-AssociatedBetCard
// (Mes pronos, §11 SPEC_ECRAN_MES_PRONOS) et de l'ex-MyBetRow (Mes paris, §5
// SPEC_ECRAN_MES_PARIS) : TOUS les statuts sont montrés (§11.3/§5), y compris
// annulé et refusé — les masquer donnerait l'impression fausse qu'aucun pari
// n'a existé. Utilisé sur les DEUX onglets dès qu'un pari existe et n'est
// PLUS éditable (statut ≠ DRAFT/SUBMITTED, ou match verrouillé — §3.3 de la
// spec : les deux deadlines coïncident). Le chemin ÉDITABLE (CTA "Parier" /
// InlineBetForm) reste orchestré par l'appelant (UpcomingRowForm), jamais ici.

const STATUS_LABEL: Record<PlayAssociatedBet["status"], string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  VALIDATED: "Validé",
  REJECTED: "Refusé",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELLED: "Neutralisé",
};

// Vert/rouge réservés au RÉSULTAT du pari (T7) ; annulé = neutralisé (barré +
// grisé), jamais confondu avec un perdu (§5 SPEC_ECRAN_MES_PARIS).
const STATUS_CLASS: Record<PlayAssociatedBet["status"], string> = {
  DRAFT: styles.statusNeutral,
  SUBMITTED: styles.statusNeutral,
  VALIDATED: styles.statusNeutral,
  REJECTED: styles.statusMuted,
  WON: styles.statusWon,
  LOST: styles.statusLost,
  CANCELLED: styles.statusCancelled,
};

const CATEGORY_LABEL = Object.fromEntries(BET_CATEGORY_OPTIONS.map((o) => [o.value, o.label])) as Record<
  PlayAssociatedBet["category"],
  string
>;

type BetBlockProps = {
  bet: PlayAssociatedBet;
  /** Onglet d'origine, pour rediriger au bon endroit après la requête de
   *  correction (§2.1 de la spec : ce mécanisme n'existait pas avant la
   *  fusion, le pari vivait toujours sur le même écran fixe). */
  returnTo: string;
  forceOpenCorrection?: boolean;
  correctionError?: string;
};

export function BetBlock({ bet, returnTo, forceOpenCorrection = false, correctionError }: BetBlockProps) {
  const isCancelled = bet.status === "CANCELLED";

  return (
    <div className={styles.card}>
      <p className={isCancelled ? `${styles.description} ${styles.descriptionCancelled}` : styles.description}>
        {bet.description}
      </p>
      <span className={styles.meta}>
        {CATEGORY_LABEL[bet.category]} · difficulté {bet.difficulty}
        {!bet.isDifficultyValidated && " (proposée)"}
      </span>
      <span className={`${styles.status} ${STATUS_CLASS[bet.status]}`}>{STATUS_LABEL[bet.status]}</span>
      {bet.pointsAwarded !== null && <span className={styles.points}>{bet.pointsAwarded} pts</span>}
      {bet.isCalculable && bet.status !== "DRAFT" && bet.status !== "SUBMITTED" && bet.calculatedProba !== null && (
        <span className={styles.aiProba}>
          Proba calculée : {Math.round(bet.calculatedProba * 100)}% (palier {bet.suggestedDifficulty})
        </span>
      )}

      {bet.status === "REJECTED" && bet.refusalReason && <p className={styles.reason}>Motif du refus : {bet.refusalReason}</p>}
      {bet.reproposeHref && (
        <Link href={bet.reproposeHref} className={styles.editLink}>
          Reproposer
        </Link>
      )}
      {(bet.status === "WON" || bet.status === "LOST" || bet.status === "CANCELLED") && bet.resolutionReason && (
        <p className={styles.reason}>{bet.resolutionReason}</p>
      )}
      {bet.isAdminCorrected && <span className={styles.correctedBadge}>Corrigé par un admin</span>}

      {bet.isForgottenResolution && (
        <BetCorrectionForm
          betId={bet.betId}
          returnTo={returnTo}
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
  returnTo: string;
  hasPendingRequest: boolean;
  forceOpen: boolean;
  error?: string;
};

function BetCorrectionForm({ betId, returnTo, hasPendingRequest, forceOpen, error }: BetCorrectionFormProps) {
  // Une requête PENDING bloque déjà côté base (migration #11) — on évite ici
  // de proposer un second dépôt qui échouerait forcément.
  if (hasPendingRequest) {
    return <p className={styles.pending}>Requête en attente.</p>;
  }

  return (
    <details className={styles.details} open={forceOpen}>
      <summary className={styles.summary}>Signaler à un admin</summary>

      {error && <p className={styles.error}>{error}</p>}

      <form action={requestBetCorrectionFormAction} className={styles.form}>
        <input type="hidden" name="betId" value={betId} />
        <input type="hidden" name="returnTo" value={returnTo} />
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
