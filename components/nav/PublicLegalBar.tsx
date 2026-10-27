import Link from "next/link";
import styles from "./PublicNav.module.css";

// Rangée secondaire distincte de la nav réduite (0.2.9 §3, T6a §3.1,
// volontairement Classement/Bracket/Règles/Se connecter uniquement) -- seul
// point d'accès aux pages légales pour un visiteur non connecté (03/09/2026,
// chantier RGPD).
export function PublicLegalBar() {
  return (
    <div className={styles.legalBar} aria-label="Informations légales">
      <Link href="/mentions-legales" className={styles.legalLink}>
        Mentions légales
      </Link>
      <Link href="/confidentialite" className={styles.legalLink}>
        Confidentialité
      </Link>
      <Link href="/cgu" className={styles.legalLink}>
        CGU
      </Link>
    </div>
  );
}
