"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./PublicNav.module.css";

// Lien de connexion de la nav publique. Sur l'accueil, le visiteur est là pour
// jouer sans compte : « Se connecter » en avant lui ferait croire qu'il en faut
// un, on garde donc un lien discret pour ceux qui en ont déjà un.
export function PublicNavAccount() {
  const onHome = usePathname() === "/";
  return (
    <Link href="/login" className={onHome ? styles.link : styles.linkCta}>
      {onHome ? "J'ai un compte" : "Se connecter"}
    </Link>
  );
}
