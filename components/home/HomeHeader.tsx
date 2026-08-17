import type { HomeHeader as HomeHeaderData } from "@/lib/queries/home";
import styles from "./HomeHeader.module.css";

// En-tête rang/points (SPEC_ECRAN_ACCUEIL §3). Purement présentationnel :
// toute la logique (rang, écart au leader, élan 7 j) vient déjà calculée de
// lib/queries/home.ts.
type HomeHeaderProps = {
  header: HomeHeaderData;
};

// Suffixe ordinal FR : 1er, sinon 2e/3e/... (pas de "ème", même registre
// court que le reste de l'écran).
function rankSuffix(rank: number): string {
  return rank === 1 ? "er" : "e";
}

export function HomeHeader({ header }: HomeHeaderProps) {
  const { pseudo, competitionName, rank, totalPoints, pointsBehindLeader, recentFormPoints } =
    header;

  return (
    <section className={`${styles.card} glass-card`} aria-label="Ton classement">
      <div className={styles.greetingBlock}>
        <p className={styles.greeting}>
          Salut, <span className={styles.pseudo}>{pseudo}</span>
        </p>
        <p className={styles.competition}>{competitionName}</p>
      </div>

      {/* Le rang devient le chiffre hero (points/écart en secondaire) : les 3
          valeurs avaient jusqu'ici le même poids visuel malgré une hiérarchie
          d'usage réelle (le rang est ce qu'on vient vérifier en premier). */}
      <div className={styles.statsHero}>
        <span className={styles.rankHero}>
          {rank === null ? "-" : (
            <>
              {rank}
              <sup>{rankSuffix(rank)}</sup>
            </>
          )}
        </span>
        <span className={styles.ptsSecondary}>
          {totalPoints}
          <span>pts</span>
        </span>
        {pointsBehindLeader !== null && (
          <span className={styles.leaderChip}>
            -<b>{pointsBehindLeader}</b> vs 1er
          </span>
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
