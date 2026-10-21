import { deleteAccountFormAction } from "@/lib/actions/account";
import styles from "./profileShared.module.css";

export function DangerSection({ pseudo, error }: { pseudo: string; error?: string }) {
  return (
    <section className={`${styles.section} glass-card`}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.fieldLabel}>
        Supprimer ton compte efface définitivement ton profil, tes paris, tes pronostics, tes messages de chat et tes
        signalements. Cette action est irréversible.
      </p>
      <form action={deleteAccountFormAction} className={styles.dangerForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Tape ton pseudo « {pseudo} » pour confirmer</span>
          <input type="text" name="pseudoConfirm" required autoComplete="off" className={styles.leagueInput} />
        </label>
        <button type="submit" className={styles.logoutButton}>
          Supprimer définitivement mon compte
        </button>
      </form>
    </section>
  );
}
