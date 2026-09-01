import styles from "./WipDisclaimer.module.css";

// Bandeau temporaire (demandé par l'utilisateur le 01/09/2026) : rappelle
// que les visuels des écrans encore en chantier ne sont pas définitifs.
// À retirer quand le design sera figé.
export function WipDisclaimer() {
  return (
    <p className={styles.disclaimer}>
      Les visuels de l'application ne sont pas définitifs — le design est encore en cours de travail.
    </p>
  );
}
