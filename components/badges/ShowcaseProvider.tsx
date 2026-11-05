"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BadgeDisplay } from "@/lib/queries/badges";
import { BadgeEmblem } from "./BadgeEmblem";
import styles from "./ShowcaseChip.module.css";

// Lot 6 « Ailleurs » : l'écusson signature d'un joueur à côté de son pseudo
// dans le chat et les pop-up « pronos / paris des autres ». La page résout une
// seule fois les vitrines (getRowShowcases, une salve) et les met dans ce
// contexte : pas de prop à faire descendre à travers les cartes de match.
// Pastille statique (aucun pop-over) : elle vit dans des dialogues qui ont déjà
// leur propre piège de focus. Joueur absent de la table = rien d'affiché.
const ShowcaseContext = createContext<Record<string, BadgeDisplay[]>>({});

export function ShowcaseProvider({
  showcases,
  children,
}: {
  showcases: Record<string, BadgeDisplay[]>;
  children: ReactNode;
}) {
  return <ShowcaseContext.Provider value={showcases}>{children}</ShowcaseContext.Provider>;
}

export function ShowcaseChip({ userId }: { userId: string }) {
  const badge = useContext(ShowcaseContext)[userId]?.[0];
  if (!badge) return null;
  return (
    <span className={styles.chip} title={badge.label}>
      <BadgeEmblem badge={badge} size="sm" />
      <span className={styles.sr}>Badge : {badge.label}</span>
    </span>
  );
}
