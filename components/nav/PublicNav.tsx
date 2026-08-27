import Link from "next/link";
import Image from "next/image";
import styles from "./PublicNav.module.css";

// Nav réduite du visiteur non connecté (0.2.9 §3, T6a §3.1) : Classement,
// Bracket, Règles (ajouté 20/08/2026, même patron dual-nav que les 2
// précédents), CTA discret « Se connecter ». Aucun état interne →
// composant serveur, partagé entre (public)/layout.tsx et les enveloppes
// fines /leaderboard, /bracket, /regles (T6a §3.2/§8.1).
//
// Nom "Panier Ballon" + logo (27/08/2026, provisoire -- ni l'un ni l'autre
// validés à 100%, voir Cadrage/panier_ballon_cadrage_business_communication.md
// et GAPS_OUVERTS.md). `unoptimized` sur le logo SVG : même contrainte que
// TeamLogo.tsx (l'optimiseur Next n'accepte pas les SVG sans config CSP
// dédiée, non posée).
export function PublicNav() {
  return (
    <nav className={styles.bar} aria-label="Navigation">
      <span className={styles.brand}>
        <Image src="/brand/logo.svg" alt="" width={28} height={31} unoptimized className={styles.brandLogo} />
        Panier Ballon
      </span>
      <div className={styles.links}>
        <Link href="/leaderboard" className={styles.link}>
          Classement
        </Link>
        <Link href="/bracket" className={styles.link}>
          Bracket
        </Link>
        <Link href="/regles" className={styles.link}>
          Règles
        </Link>
        <Link href="/login" className={styles.linkCta}>
          Se connecter
        </Link>
      </div>
    </nav>
  );
}
