import type { PendingPseudoRequest } from "@/lib/queries/pseudo-requests";
import { approvePseudoChangeFormAction, rejectPseudoChangeFormAction } from "@/lib/actions/pseudo";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { parisDateTimeLabel } from "@/lib/dates/paris";
import styles from "./RequestCard.module.css";

// Une demande de changement de pseudo : approuver (un clic) ou refuser avec
// un motif facultatif. Deux formulaires natifs, aucun "use client". Réutilise
// le style de RequestCard (même file de traitement côté admin).

type PseudoRequestCardProps = {
  request: PendingPseudoRequest;
  error?: string;
};

export function PseudoRequestCard({ request, error }: PseudoRequestCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <p className={styles.player}>
          <PlayerLink userId={request.userId} pseudo={request.oldPseudo} />
        </p>
        <span className={styles.timestamp}>{parisDateTimeLabel(request.createdAt)}</span>
      </div>
      <p className={styles.description}>
        {request.oldPseudo} → <strong>{request.requestedPseudo}</strong>
      </p>

      {error && <p className={styles.error}>{error}</p>}

      <form action={approvePseudoChangeFormAction} className={styles.processForm}>
        <input type="hidden" name="requestId" value={request.requestId} />
        <button type="submit" className={styles.processButton}>
          Approuver
        </button>
      </form>

      <form action={rejectPseudoChangeFormAction} className={styles.rejectForm}>
        <input type="hidden" name="requestId" value={request.requestId} />
        <label className={styles.field}>
          Motif de refus (facultatif, visible du joueur)
          <textarea name="reason" rows={2} maxLength={300} className={styles.textarea} />
        </label>
        <button type="submit" className={styles.rejectButton}>
          Refuser
        </button>
      </form>
    </li>
  );
}
