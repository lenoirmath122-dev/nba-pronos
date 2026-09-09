"use client";

import { useCallback, useState } from "react";
import type { LeaderboardRow as RowData, SortKey } from "@/lib/queries/leaderboard";
import { LeaderboardRow } from "./LeaderboardRow";

type LeaderboardRowListProps = {
  rows: RowData[];
  sortKey: SortKey;
};

// Accordéon (15/08/2026, demandé après coup) : au plus UNE ligne dépliée à la
// fois — état levé ICI, au-dessus de LeaderboardRow (redevenu un composant
// contrôlé, cf. son commentaire d'en-tête), plutôt que dans LeaderboardTable
// qui reste un composant serveur (T6a). Seul module client ajouté par ce
// changement.
export function LeaderboardRowList({ rows, sortKey }: LeaderboardRowListProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // p1-29 (feuille de route Phase 1) : référence STABLE entre re-renders
  // (useCallback sans dépendance, le setter fonctionnel n'a besoin de rien
  // d'autre) — condition pour que React.memo sur LeaderboardRow (voir ce
  // fichier) empêche les lignes non concernées de se re-rendre à chaque clic
  // déplier/replier. Une closure inline recréée à chaque render aurait cassé
  // le memo pour TOUTES les lignes, pas seulement celle cliquée.
  const handleToggle = useCallback((userId: string) => {
    setExpandedUserId((current) => (current === userId ? null : userId));
  }, []);

  return (
    <div role="rowgroup">
      {rows.map((row) => (
        <LeaderboardRow
          key={row.userId}
          row={row}
          sortKey={sortKey}
          expanded={row.userId === expandedUserId}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
