import Link from "next/link";
import Image from "next/image";
import { PublicNavAccount } from "./PublicNavAccount";
import { PublicLegalBar } from "./PublicLegalBar";
import styles from "./PublicNav.module.css";

// Nav réduite du visiteur non connecté (0.2.9 §3, T6a §3.1) : Classement,
// Bracket, Règles (ajouté 20/08/2026, même patron dual-nav que les 2
// précédents), CTA discret « Se connecter » (« J'ai un compte » sur l'accueil,
// voir PublicNavAccount). Aucun état interne → composant serveur, partagé entre (public)/layout.tsx et les enveloppes
// fines /leaderboard, /bracket, /regles (T6a §3.2/§8.1).
//
// Nom "Panier Ballon" + logo (27/08/2026, provisoire -- ni l'un ni l'autre
// validés à 100%, voir Cadrage/Business/panier_ballon_cadrage_business_communication.md
// et GAPS_OUVERTS.md). `unoptimized` sur le logo SVG : même contrainte que
// TeamLogo.tsx (l'optimiseur Next n'accepte pas les SVG sans config CSP
// dédiée, non posée).
export function PublicNav({ legal = true }: { legal?: boolean } = {}) {
  return (
    <>
      <nav className={styles.bar} aria-label="Navigation">
        <a href="https://panierballon.fr/" className={styles.brand}>
          <Image src="/brand/logo-horizontal.svg" alt="Panier Ballon" width={128} height={24} unoptimized className={styles.brandLogo} />
        </a>
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
          <PublicNavAccount />
        </div>
      </nav>
      {legal ? <PublicLegalBar /> : null}
    </>
  );
}
