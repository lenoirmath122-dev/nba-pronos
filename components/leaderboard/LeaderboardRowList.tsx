"use client";

import { useState } from "react";
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

  return (
    <div role="rowgroup">
      {rows.map((row) => (
        <LeaderboardRow
          key={row.userId}
          row={row}
          sortKey={sortKey}
          expanded={row.userId === expandedUserId}
          onToggle={() => setExpandedUserId((current) => (current === row.userId ? null : row.userId))}
        />
      ))}
    </div>
  );
}
