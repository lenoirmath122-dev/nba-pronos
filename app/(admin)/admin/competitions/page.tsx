import Link from "next/link";
import { getActiveCompetitionSummary } from "@/lib/queries/admin-competitions";
import styles from "./page.module.css";

// Gestion des compétitions (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1, VALIDÉ) —
// lot 1/3 (création). Composant serveur, aucun "use client". Bouton
// Clôturer VISIBLE mais DÉSACTIVÉ (lot 3, pas encore codé).

const TYPE_LABEL: Record<"PLAYOFFS" | "NBA_CUP", string> = { PLAYOFFS: "Playoffs", NBA_CUP: "NBA Cup" };

export default async function AdminCompetitionsPage() {
  const competition = await getActiveCompetitionSummary();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Compétitions</h1>

      {!competition ? (
        <>
          <p className={styles.empty}>Aucune compétition en cours.</p>
          <Link href="/admin/competitions/new" className={styles.createLink}>
            Créer une nouvelle compétition
          </Link>
        </>
      ) : (
        <div className={styles.card}>
          <p className={styles.name}>{competition.name}</p>
          <p className={styles.meta}>{TYPE_LABEL[competition.type]}</p>
          <div className={styles.joinCode}>
            <span className={styles.joinCodeLabel}>Code de compétition</span>
            <span className={styles.joinCodeValue}>{competition.joinCode}</span>
          </div>
          <button type="button" className={styles.closeButton} disabled title="Bientôt disponible">
            Clôturer et archiver
          </button>
        </div>
      )}
    </div>
  );
}
