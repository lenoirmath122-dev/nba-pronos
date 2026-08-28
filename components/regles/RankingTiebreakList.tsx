import styles from "./RuleContent.module.css";

// Ordre de départage du classement en cas d'égalité — extrait de
// app/regles/page.tsx (28/08/2026) pour être réutilisé dans le pop-up d'aide
// de l'écran Classement (RuleHelpButton sur app/leaderboard/page.tsx). Ordre
// aligné sur lib/scoring/ranking.ts::compareForRank.
export function RankingTiebreakList() {
  return (
    <>
      <ul className={styles.list}>
        <li className={styles.listItem}>
          <span>Total de points</span>
        </li>
        <li className={styles.listItem}>
          <span>Nombre de bons vainqueurs de match</span>
        </li>
        <li className={styles.listItem}>
          <span>Nombre d&apos;écarts exacts</span>
        </li>
        <li className={styles.listItem}>
          <span>Points de bracket</span>
        </li>
      </ul>
      <p className={styles.note}>
        Si tout est encore égal après ces 4 critères, l&apos;égalité est assumée — les joueurs partagent
        le même rang.
      </p>
    </>
  );
}
