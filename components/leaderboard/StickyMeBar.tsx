"use client";

import { useEffect, useState } from "react";
import styles from "./StickyMeBar.module.css";

// Barre « toi » collante (§3) : SEULE responsabilité — IntersectionObserver
// sur la ligne du joueur (id="me-row", posé par LeaderboardRow). Le rendu
// n'a lieu QUE si le joueur classé sort du viewport ; la condition
// « rankedCount > 20 et currentUserRank non nul » est déjà tranchée par
// l'appelant (LeaderboardTable/page), qui ne monte ce composant que si elle
// est vraie.
type StickyMeBarProps = {
  rank: number;
  pseudo: string;
  totalPoints: number;
};

export function StickyMeBar({ rank, pseudo, totalPoints }: StickyMeBarProps) {
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
    <a href="#me-row" className={styles.bar}>
      <span className={styles.rank}>#{rank}</span>
      <span className={styles.pseudo}>{pseudo}</span>
      <span className={styles.total}>{totalPoints} pts</span>
    </a>
  );
}
