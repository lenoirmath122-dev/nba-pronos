import type { HomeHeader as HomeHeaderData } from "@/lib/queries/home";
import styles from "./HomeHeader.module.css";

// En-tête rang/points (SPEC_ECRAN_ACCUEIL §3). Purement présentationnel :
// toute la logique (rang, écart au leader, élan 7 j) vient déjà calculée de
// lib/queries/home.ts.
type HomeHeaderProps = {
  header: HomeHeaderData;
};

export function HomeHeader({ header }: HomeHeaderProps) {
  const { pseudo, competitionName, rank, totalPoints, pointsBehindLeader, recentFormPoints } =
    header;

  return (
    <section className={styles.card} aria-label="Ton classement">
      <p className={styles.greeting}>
        Salut, <span className={styles.pseudo}>{pseudo}</span>
      </p>
      <p className={styles.competition}>{competitionName}</p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Rang</span>
          <span className={styles.statValue}>{rank === null ? "-" : `#${rank}`}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Points</span>
          <span className={styles.statValue}>{totalPoints}</span>
        </div>
        {pointsBehindLeader !== null && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Derrière le leader</span>
            <span className={styles.statValue}>-{pointsBehindLeader}</span>
          </div>
        )}
      </div>

      {rank === null ? (
        <p className={styles.hint}>Fais ton premier prono pour entrer au classement.</p>
      ) : (
        <p className={styles.form}>
          {recentFormPoints > 0 ? `+${recentFormPoints}` : recentFormPoints} pts cette semaine
        </p>
      )}
    </section>
  );
}
