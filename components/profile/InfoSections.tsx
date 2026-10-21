import Link from "next/link";
import styles from "./profileShared.module.css";

export function DataSection() {
  return (
    <section className={`${styles.section} glass-card`}>
      <p className={styles.fieldLabel}>
        Télécharge une copie de tes données personnelles (profil, pronostics de match, bracket, paris, badges, palmarès
        hebdo, mentions dans la popup du lundi, messages de chat, signalements de bug, ligues) au format JSON.
      </p>
      <a href="/api/account/export" className={styles.helpLink}>
        Télécharger mes données
      </a>
    </section>
  );
}

export function HelpSection() {
  return (
    <section className={`${styles.section} glass-card`}>
      <Link href="/regles" className={styles.helpLink}>
        Règles du jeu
      </Link>
    </section>
  );
}

export function LegalSection() {
  return (
    <section className={`${styles.section} glass-card`}>
      <Link href="/mentions-legales" className={styles.helpLink}>
        Mentions légales
      </Link>
      <Link href="/confidentialite" className={styles.helpLink}>
        Politique de confidentialité
      </Link>
      <Link href="/cgu" className={styles.helpLink}>
        Conditions générales d&apos;utilisation
      </Link>
    </section>
  );
}
