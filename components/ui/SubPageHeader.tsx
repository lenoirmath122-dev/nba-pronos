"use client";

import { useRouter } from "next/navigation";
import { hasInternalNavigation, PROFILE_MENU_URL } from "@/lib/nav/profileMenu";
import styles from "./SubPageHeader.module.css";

// En-tête commun des sous-pages du menu Profil (Stats, Pseudo, Ligues...) :
// bouton retour + titre. Retour = écran précédent s'il y a un historique
// interne à l'app (le panneau Profil, ouvert via une entrée d'historique,
// se rouvre alors tout seul) ; sinon accueil avec le panneau ouvert.
export function SubPageHeader({ title, tone }: { title: string; tone?: "danger" }) {
  const router = useRouter();
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.back}
        aria-label="Retour"
        onClick={() => (hasInternalNavigation() ? router.back() : router.push(PROFILE_MENU_URL))}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <h1 className={tone === "danger" ? `${styles.title} ${styles.titleDanger}` : styles.title}>{title}</h1>
    </header>
  );
}
