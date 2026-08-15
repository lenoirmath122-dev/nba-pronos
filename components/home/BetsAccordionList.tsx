"use client";

import { useState } from "react";
import type { BetTodoItem } from "@/lib/queries/home";
import { BetGroupRow } from "./BetGroupRow";
import styles from "./BetsAccordionList.module.css";

type BetsAccordionListProps = {
  seriesBets: BetTodoItem[];
  matchBets: BetTodoItem[];
};

type GroupKey = "series" | "matches";

// Accordéon de la section « Paris » (15/08/2026) : au plus UN groupe déplié à
// la fois — même patron que components/leaderboard/LeaderboardRowList.tsx
// (état levé ici, chaque BetGroupRow redevient un composant contrôlé). Un
// groupe vide n'est pas rendu du tout (généralise la règle déjà appliquée à
// l'ancienne section « Paris séries », jamais d'état vide ici).
export function BetsAccordionList({ seriesBets, matchBets }: BetsAccordionListProps) {
  const [expandedGroup, setExpandedGroup] = useState<GroupKey | null>(null);

  return (
    <div className={styles.wrapper}>
      {seriesBets.length > 0 && (
        <BetGroupRow
          label="Séries"
          items={seriesBets}
          feminine
          expanded={expandedGroup === "series"}
          onToggle={() => setExpandedGroup((current) => (current === "series" ? null : "series"))}
        />
      )}
      {matchBets.length > 0 && (
        <BetGroupRow
          label="Matchs"
          items={matchBets}
          feminine={false}
          expanded={expandedGroup === "matches"}
          onToggle={() => setExpandedGroup((current) => (current === "matches" ? null : "matches"))}
        />
      )}
    </div>
  );
}
