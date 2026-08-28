import styles from "./RuleContent.module.css";

// Version COURTE et dédiée des conseils de rédaction d'un pari (28/08/2026,
// pop-up d'aide de InlineBetForm.tsx) — délibérément PAS la même liste
// exhaustive que app/regles/page.tsx §"Bien rédiger un pari" (8 catégories) :
// au moment de rédiger, quelques exemples ciblés valent mieux qu'une liste
// complète à parcourir. Les valeurs de difficulté restent partagées
// (BetDifficulteGrid), seul ce texte est indépendant de /regles.
export function BetWritingTips() {
  return (
    <>
      <p className={styles.body}>
        Vise un joueur, une équipe et un seuil chiffré précis — plus c&apos;est précis, mieux l&apos;IA
        le reconnaît, et plus vite il est validé (sans attendre un admin).
      </p>
      <ul className={styles.list}>
        <li className={styles.listItem}>
          <span>« Nikola Jokic réalise un triple-double. »</span>
        </li>
        <li className={styles.listItem}>
          <span>« Les Boston Celtics inscrivent plus de 45 rebonds. »</span>
        </li>
        <li className={styles.listItem}>
          <span>« Jaylen Brown marque plus de points que tout autre joueur du match. »</span>
        </li>
        <li className={styles.listItem}>
          <span>
            « Cade Cunningham marque plus de 25 points et réalise plus de 5 passes décisives. »
          </span>
        </li>
      </ul>
      <p className={styles.note}>
        Pas calculable : une blessure, le score exact du match, une égalité stricte entre deux
        joueurs, ou une formulation sans stat ni événement précis.
      </p>
    </>
  );
}
