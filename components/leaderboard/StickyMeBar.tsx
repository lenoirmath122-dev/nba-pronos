"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./StickyMeBar.module.css";

// Barre « toi » collante (§3) : SEULE responsabilité — IntersectionObserver
// sur la ligne du joueur (id="me-row", posé par LeaderboardRow). Le rendu
// n'a lieu QUE si le joueur classé sort du viewport ; la condition
// « rankedCount > 20 et currentUserRank non nul » est déjà tranchée par
// l'appelant (LeaderboardTable/page), qui ne monte ce composant que si elle
// est vraie.
type StickyMeBarProps = {
  rank: number;
  /** Avatar + pseudo + écusson, rendus côté serveur (PlayerIdentity size="bar"). */
  identity: ReactNode;
  totalPoints: number;
};

export function StickyMeBar({ rank, identity, totalPoints }: StickyMeBarProps) {
  // Masquée tant que la ligne "toi" n'a pas été observée hors du viewport
  // (pas de flash au premier rendu).
  const [outOfView, setOutOfView] = useState(false);

  useEffect(() => {
    const target = document.getElementById("me-row");
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => setOutOfView(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!outOfView) return null;

  return (
    // Un lien ne peut pas contenir les boutons des écussons : le lien « retour à
    // ma ligne » s'étire sur toute la barre (::after) et la vitrine passe
    // au-dessus pour rester cliquable.
    <div className={styles.bar}>
      <a href="#me-row" className={styles.jump} aria-label={`Aller à ma ligne, ${rank}e`}>
        <span className={styles.rank}>#{rank}</span>
      </a>
      <span className={styles.identity}>{identity}</span>
      <span className={styles.total}>{totalPoints} pts</span>
    </div>
  );
}
