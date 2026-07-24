import type { CorrectionRequestState, TeamRef } from "@/lib/queries/my-predictions";
import { requestPredictionCorrectionFormAction } from "@/lib/actions/corrections";
import styles from "./CorrectionRequestForm.module.css";

// Requête de correction (§10) — SEULE écriture de l'écran, possible depuis
// les TROIS états du §8 (y compris un match jamais ouvert, voie A §10.2).
// <form action={...}> natif (§1.1 point 3) : aucun JS, erreur rendue au
// rechargement (portée par l'URL, cf. lib/actions/corrections.ts).

type CorrectionRequestFormProps = {
  matchId: string;
  home: TeamRef;
  away: TeamRef;
  correctionRequest: CorrectionRequestState | null;
  returnTo: string;
  forceOpen: boolean;
  error?: string;
};

export function CorrectionRequestForm({
  matchId,
  home,
  away,
  correctionRequest,
  returnTo,
  forceOpen,
  error,
}: CorrectionRequestFormProps) {
  // Une requête PENDING bloque déjà côté base (§10.3) — on évite ici de
  // proposer un second dépôt qui échouerait forcément, sans dupliquer le
  // garde-fou (il reste entièrement dans la fonction SQL).
  if (correctionRequest?.status === "PENDING") {
    return <p className={styles.pending}>Requête en attente.</p>;
  }

  return (
    <details className={styles.details} open={forceOpen}>
      <summary className={styles.summary}>Demander une correction</summary>

      {correctionRequest?.status === "REJECTED" && (
        <p className={styles.rejected}>Requête refusée : {correctionRequest.adminReason}</p>
      )}
      {error && <p className={styles.error}>{error}</p>}

      <form action={requestPredictionCorrectionFormAction} className={styles.form}>
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <label className={styles.field}>
          Motif
          <textarea name="justification" required rows={2} className={styles.textarea} />
        </label>

        <label className={styles.field}>
          Vainqueur proposé (optionnel)
          <select name="proposedWinnerTeamId" defaultValue="" className={styles.select}>
            <option value="">—</option>
            <option value={home.id}>{home.abbreviation}</option>
            <option value={away.id}>{away.abbreviation}</option>
          </select>
        </label>

        <label className={styles.field}>
          Écart proposé (optionnel)
          <input type="number" name="proposedMargin" min={1} max={50} className={styles.input} />
        </label>

        <button type="submit" className={styles.submit}>
          Envoyer la requête
        </button>
      </form>
    </details>
  );
}
