import type { AssociatedBet } from "@/lib/queries/my-predictions";
import styles from "./AssociatedBetCard.module.css";

// Rappel du pari associé (§11) — LECTURE SEULE, inerte : le détail, les
// actions et le cycle de vie complet restent sur /play/bets (lot "Paris",
// pas encore codé). §11.3 : TOUS les statuts sont montrés, y compris annulé
// et refusé — les masquer donnerait l'impression fausse qu'aucun pari
// n'a existé sur ce match.

const STATUS_LABEL: Record<AssociatedBet["status"], string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  VALIDATED: "Validé",
  REJECTED: "Refusé",
  WON: "Gagné",
  LOST: "Perdu",
  CANCELLED: "Neutralisé",
};

// Vert/rouge réservés au RÉSULTAT du pari (T7) ; annulé = neutralisé (barré +
// grisé), jamais confondu avec un pari perdu (§11.3).
const STATUS_CLASS: Record<AssociatedBet["status"], string> = {
  DRAFT: styles.statusNeutral,
  SUBMITTED: styles.statusNeutral,
  VALIDATED: styles.statusNeutral,
  REJECTED: styles.statusMuted,
  WON: styles.statusWon,
  LOST: styles.statusLost,
  CANCELLED: styles.statusCancelled,
};

type AssociatedBetCardProps = { bet: AssociatedBet };

export function AssociatedBetCard({ bet }: AssociatedBetCardProps) {
  const isCancelled = bet.status === "CANCELLED";

  return (
    <div className={styles.card}>
      <p className={isCancelled ? `${styles.description} ${styles.descriptionCancelled}` : styles.description}>
        {bet.description}
      </p>
      <span className={styles.meta}>
        {bet.category} · difficulté {bet.difficulty}
        {!bet.isDifficultyValidated && " (proposée)"}
      </span>
      <span className={`${styles.status} ${STATUS_CLASS[bet.status]}`}>{STATUS_LABEL[bet.status]}</span>
      <span className={styles.points}>{bet.points === null ? "—" : `${bet.points} pts`}</span>
    </div>
  );
}
