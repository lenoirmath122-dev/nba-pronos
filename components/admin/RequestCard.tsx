import type { PendingCorrectionRequest } from "@/lib/queries/admin-requests";
import { processCorrectionRequestFormAction, rejectCorrectionRequestFormAction } from "@/lib/actions/admin-requests";
import styles from "./RequestCard.module.css";

// Une carte de la file des requêtes (SPEC_ECRAN_ADMIN_REQUESTS_V0_1 §2) —
// DEUX rendus selon targetType (§0 : asymétrie réelle, pas un oubli).
// 2 formulaires natifs indépendants (Traiter / Refuser), aucun "use client".

function formatDate(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    date
  );
}

type RequestCardProps = {
  request: PendingCorrectionRequest;
  error?: string;
};

export function RequestCard({ request, error }: RequestCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.header}>
        <p className={styles.player}>{request.requesterPseudo}</p>
        <span className={styles.timestamp}>{formatDate(request.createdAt)}</span>
      </div>
      <p className={styles.target}>{request.targetLabel}</p>
      <p className={styles.justification}>« {request.justification} »</p>

      {error && <p className={styles.error}>{error}</p>}

      {request.targetType === "MATCH_PREDICTION" ? (
        <MatchPredictionFields request={request} />
      ) : (
        <BetFields request={request} />
      )}

      <form action={rejectCorrectionRequestFormAction} className={styles.rejectForm}>
        <input type="hidden" name="requestId" value={request.requestId} />
        <label className={styles.field}>
          Motif de refus
          <textarea name="reason" required rows={2} className={styles.textarea} />
        </label>
        <button type="submit" className={styles.rejectButton}>
          Refuser
        </button>
      </form>
    </li>
  );
}

function MatchPredictionFields({ request }: { request: Extract<PendingCorrectionRequest, { targetType: "MATCH_PREDICTION" }> }) {
  const defaultWinner = request.proposedWinnerTeamId ?? request.currentWinnerTeamId ?? "";
  const defaultMargin = request.proposedMargin ?? request.currentMargin ?? "";

  return (
    <form action={processCorrectionRequestFormAction} className={styles.processForm}>
      <input type="hidden" name="requestId" value={request.requestId} />

      {(request.proposedWinnerTeamId || request.proposedMargin) && (
        <p className={styles.suggested}>Suggestion du joueur prise en compte ci-dessous.</p>
      )}

      <label className={styles.field}>
        Vainqueur
        <select name="correctedWinnerTeamId" defaultValue={defaultWinner} required className={styles.select}>
          <option value="" disabled>
            Choisir…
          </option>
          {request.teamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.abbreviation}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        Écart
        <input type="number" name="correctedMargin" min={1} max={50} defaultValue={defaultMargin} required className={styles.select} />
      </label>

      <label className={styles.field}>
        Motif (visible publiquement sur le prono corrigé)
        <textarea name="reason" rows={2} className={styles.textarea} />
      </label>

      <button type="submit" className={styles.processButton}>
        Traiter
      </button>
    </form>
  );
}

function BetFields({ request }: { request: Extract<PendingCorrectionRequest, { targetType: "BET" }> }) {
  return (
    <form action={processCorrectionRequestFormAction} className={styles.processForm}>
      <input type="hidden" name="requestId" value={request.requestId} />
      <p className={styles.description}>{request.description}</p>
      <p className={styles.betNote}>
        Ce pari attend une résolution — traite-le via{" "}
        <a href="/admin/resolution" className={styles.link}>
          la file de résolution
        </a>
        , puis clôture cette requête ci-dessous.
      </p>
      <label className={styles.field}>
        Motif (visible publiquement)
        <textarea name="reason" rows={2} className={styles.textarea} />
      </label>
      <button type="submit" className={styles.processButton}>
        Traiter (clôturer la requête)
      </button>
    </form>
  );
}
