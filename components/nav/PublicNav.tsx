import Link from "next/link";
import styles from "./PublicNav.module.css";

// Nav réduite du visiteur non connecté (0.2.9 §3, T6a §3.1) : Classement,
// Bracket, CTA discret « Se connecter ». Aucun état interne → composant
// serveur, partagé entre (public)/layout.tsx et les enveloppes fines
// /leaderboard, /bracket (T6a §3.2/§8.1).
export function PublicNav() {
  return (
    <nav className={styles.bar} aria-label="Navigation">
      <span className={styles.brand}>NBA Pronos</span>
      <div className={styles.links}>
        <Link href="/leaderboard" className={styles.link}>
          Classement
        </Link>
        <Link href="/bracket" className={styles.link}>
          Bracket
        </Link>
        <Link href="/login" className={styles.linkCta}>
          Se connecter
        </Link>
      </div>
    </nav>
  );
}
