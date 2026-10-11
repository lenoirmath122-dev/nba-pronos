import Link from "next/link";
import { getActiveCompetitionSummary } from "@/lib/queries/admin-competitions";
import { CloseCompetitionButton } from "@/components/admin/CloseCompetitionButton";
import { FreezeWeekButton } from "@/components/admin/FreezeWeekButton";
import { setWeeklyRankingFormAction } from "@/lib/actions/admin-competitions";
import styles from "./page.module.css";
import type { CompetitionType } from "@/lib/competitions/types";

// Gestion des compétitions (SPEC_ECRAN_ADMIN_COMPETITIONS_V0_1, VALIDÉ) —
// lots 1/3 (création) et 3/3 (clôture/archivage, §9). Lien vers
// /admin/competitions/results (lot 2/3, SPEC_ECRAN_ADMIN_RESULTATS_V0_1).
// Composant serveur ; CloseCompetitionButton est la SEULE feuille
// "use client" de l'écran (dialogue de confirmation, même patron que
// RecalculateButton sur le tableau de bord admin).

const TYPE_LABEL: Record<CompetitionType, string> = { PLAYOFFS: "Playoffs", NBA_CUP: "NBA Cup", DAILY_MATCH: "Match du jour" };

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
          <div className={styles.weekly}>
            <span className={styles.weeklyTitle}>Classement hebdomadaire</span>
            {competition.weeklyRanking === null ? (
              <p className={styles.weeklyNote}>
                Indisponible : la migration 20261012090000 n&apos;est pas encore poussée.
              </p>
            ) : (
              <>
                <p className={styles.weeklyNote}>
                  {competition.weeklyRanking
                    ? "Activé : un champion par semaine (lundi 10h → lundi 10h, heure de Paris), figé automatiquement par le cron."
                    : "Désactivé."}
                </p>
                {competition.lastFrozenWeek && (
                  <p className={styles.weeklyNote}>
                    Dernière semaine figée : {competition.lastFrozenWeek.weekEnd.slice(8, 10)}/
                    {competition.lastFrozenWeek.weekEnd.slice(5, 7)} (
                    {competition.lastFrozenWeek.champions === 0
                      ? "aucun champion"
                      : `${competition.lastFrozenWeek.champions} champion${competition.lastFrozenWeek.champions > 1 ? "s" : ""}`}
                    ).
                  </p>
                )}
                <form action={setWeeklyRankingFormAction}>
                  <input type="hidden" name="competition_id" value={competition.id} />
                  <input type="hidden" name="enabled" value={competition.weeklyRanking ? "0" : "1"} />
                  <button type="submit" className={styles.weeklyToggle}>
                    {competition.weeklyRanking ? "Désactiver" : "Activer"}
                  </button>
                </form>
                {competition.weeklyRanking && <FreezeWeekButton />}
              </>
            )}
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
