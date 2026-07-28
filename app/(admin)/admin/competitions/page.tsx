import Link from "next/link";
import { getActiveCompetitionSummary } from "@/lib/queries/admin-competitions";
import { CloseCompetitionButton } from "@/components/admin/CloseCompetitionButton";
import styles from "./page.module.css";

// Gestion des compétitions (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1, VALIDÉ) —
// lots 1/3 (création) et 3/3 (clôture/archivage, §9). Lien vers
// /admin/competitions/results (lot 2/3, SPEC_ECRAN_ADMIN_RESULTATS_V0_1).
// Composant serveur ; CloseCompetitionButton est la SEULE feuille
// "use client" de l'écran (dialogue de confirmation, même patron que
// RecalculateButton sur le tableau de bord admin).

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
          <Link href="/admin/competitions/results" className={styles.createLink}>
            Saisir les résultats
          </Link>
          <CloseCompetitionButton competitionId={competition.id} />
        </div>
      )}
    </div>
  );
}
