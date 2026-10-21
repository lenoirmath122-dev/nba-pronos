import { requestPseudoChangeFormAction } from "@/lib/actions/pseudo";
import { PSEUDO_COOLDOWN_DAYS, PSEUDO_MAX_LENGTH, PSEUDO_MIN_LENGTH } from "@/lib/pseudo/rules";
import type { MyPseudoRequest } from "@/lib/queries/pseudo-requests";
import styles from "./profileShared.module.css";

type PseudoSectionProps = {
  pseudo: string;
  request: MyPseudoRequest | null;
  error?: string;
  sent?: boolean;
};

export function PseudoSection({ pseudo, request, error, sent }: PseudoSectionProps) {
  return (
    <section className={`${styles.section} glass-card`}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className={styles.success} role="status">
          Demande envoyée. Un admin la valide, ton pseudo actuel est conservé en attendant.
        </p>
      )}

      {request?.status === "PENDING" ? (
        <p className={styles.hint}>
          Demande en attente : « {request.requestedPseudo} ». Tu seras prévenu dès qu&apos;un admin l&apos;aura traitée.
        </p>
      ) : (
        <>
          {request?.status === "REJECTED" && (
            <p className={styles.hint}>
              Ta dernière demande (« {request.requestedPseudo} ») a été refusée
              {request.rejectReason ? ` : ${request.rejectReason}` : "."}
            </p>
          )}
          <form action={requestPseudoChangeFormAction} className={styles.preferencesForm}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nouveau pseudo</span>
              <input
                type="text"
                name="pseudo"
                required
                minLength={PSEUDO_MIN_LENGTH}
                maxLength={PSEUDO_MAX_LENGTH}
                autoComplete="off"
                placeholder={pseudo}
                className={styles.textInput}
              />
            </label>
            <p className={styles.hint}>
              {PSEUDO_MIN_LENGTH} à {PSEUDO_MAX_LENGTH} caractères. Un admin valide chaque changement, et tu ne peux en
              demander qu&apos;un tous les {PSEUDO_COOLDOWN_DAYS} jours.
            </p>
            <button type="submit" className={styles.primaryButton}>
              Demander le changement
            </button>
          </form>
        </>
      )}
    </section>
  );
}
