import type { HomeHeader as HomeHeaderData } from "@/lib/queries/home";
import { ordinal, pointsLabel } from "@/lib/recaps/text";
import styles from "./HomeHeader.module.css";

// En-tête rang/points (SPEC_ECRAN_ACCUEIL §3). Purement présentationnel :
// toute la logique (rang, écart au leader, élan 7 j) vient déjà calculée de
// lib/queries/home.ts.
type HomeHeaderProps = {
  header: HomeHeaderData;
};

// Écart au 1er en toutes lettres (« -15 vs 1er » ne se comprenait pas seul).
function leaderGapLabel(rank: number | null, behind: number): string {
  if (rank === 1) return "Tu es 1er";
  if (behind === 0) return "À égalité avec le 1er";
  return `${pointsLabel(behind)} derrière le 1er`;
}

export function HomeHeader({ header }: HomeHeaderProps) {
  const { pseudo, competitionName, weekly, rank, totalPoints, pointsBehindLeader, recentFormPoints } =
    header;

  return (
    <section className={`${styles.card} glass-card`} aria-label="Ton classement">
      <div className={styles.greetingBlock}>
        <p className={styles.greeting}>
          Salut, <span className={styles.pseudo}>{pseudo}</span>
        </p>
        <p className={styles.competition}>{competitionName.replace(" - ", " · ")}</p>
      </div>

      {/* Rang et points au même poids (même police, même taille) : l'ancien
          rang en 40px face à des points en 18px gris faisait lire le second
          comme secondaire. */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{weekly ? "Rang semaine" : "Rang"}</span>
          <span className={styles.statValue}>{rank === null ? "-" : ordinal(rank)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{weekly ? "Points semaine" : "Points"}</span>
          <span className={styles.statValue}>{pointsLabel(totalPoints)}</span>
        </div>
      </div>
      {pointsBehindLeader !== null && (
        <span className={styles.leaderChip}>{leaderGapLabel(rank, pointsBehindLeader)}</span>
      )}

      {rank === null ? (
        <p className={styles.hint}>Fais ton premier prono pour entrer au classement.</p>
      ) : weekly ? null : (
        <p className={styles.form}>
          {recentFormPoints > 0 ? `+${pointsLabel(recentFormPoints)}` : pointsLabel(recentFormPoints)} cette semaine
        </p>
      )}
    </section>
  );
}
