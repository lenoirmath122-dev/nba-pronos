"use client";

import { useState } from "react";
import type { LeaderboardRow as RowData, SortKey } from "@/lib/queries/leaderboard";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./LeaderboardRow.module.css";

// Une ligne du classement (§6/§7) : SEULE responsabilité client de cet écran
// avec StickyMeBar — expansion/repli, rien d'autre. Le badge de correction
// porte l'infobulle native du navigateur (`title`) sur desktop ; sur mobile
// il n'y a pas de hover, donc pas d'infobulle : le tap déplie déjà la ligne
// via le bouton (§7, aucune logique dédiée nécessaire).
type LeaderboardRowProps = {
  row: RowData;
  sortKey: SortKey;
};

function detailColClass(column: SortKey, sortKey: SortKey): string {
  return column === sortKey ? `${styles.colDetail} ${styles.colActive}` : styles.colDetail;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function pluralExactMargins(count: number): string {
  return count > 1 ? `${count} écarts exacts` : `${count} écart exact`;
}

export function LeaderboardRow({ row, sortKey }: LeaderboardRowProps) {
  const [expanded, setExpanded] = useState(false);

  const correctionTitle =
    row.adminCorrectionsCount > 0
      ? `${plural(row.adminCorrectionsCount, "élément")} corrigé${row.adminCorrectionsCount > 1 ? "s" : ""} par un admin, sur requête`
      : undefined;

  // Restructuré le 30/07/2026 (bouton -> div) : le pseudo devient un vrai
  // <Link> vers /players/[userId] (demandé par l'utilisateur, actif sur
  // toutes les pages) — un <a> imbriqué dans un <button> est invalide en
  // HTML, d'où le passage à un conteneur cliquable non-bouton, avec le
  // même comportement clavier (Entrée/Espace) reconstitué à la main.
  return (
    <div className={row.isInactive ? `${styles.wrapper} ${styles.rowInactive}` : styles.wrapper}>
      <div
        role="button"
        tabIndex={0}
        id={row.isCurrentUser ? "me-row" : undefined}
        className={styles.row}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((current) => !current);
          }
        }}
      >
        <span className={styles.colRank}>{row.rank}</span>

        <span className={styles.colPlayer}>
          <PlayerLink
            userId={row.userId}
            pseudo={row.pseudo}
            className={styles.pseudo}
            onClick={(event) => event.stopPropagation()}
          />
          {row.isInactive && <span className={styles.inactiveTag}>inactif</span>}
          {row.adminCorrectionsCount > 0 && (
            <span className={styles.correctionBadge} title={correctionTitle} aria-hidden="true" />
          )}
        </span>

        <span
          className={sortKey === "total" ? `${styles.colTotal} ${styles.totalBand}` : styles.colTotal}
        >
          {row.totalPoints}
        </span>
        <span className={detailColClass("matches", sortKey)}>{row.matchesPoints}</span>
        <span className={detailColClass("bracket", sortKey)}>{row.bracketPoints}</span>
        <span className={detailColClass("bets", sortKey)}>{row.betsPoints}</span>
        <span className={detailColClass("form", sortKey)}>{row.formPoints}</span>

        <span className={styles.chevron} aria-hidden="true">
          {expanded ? "⌃" : "⌄"}
        </span>
      </div>

      {expanded && (
        <div className={styles.detail}>
          <div className={styles.subtotals}>
            <div className={styles.subtotal}>
              <span className={styles.subtotalLabel}>Matchs</span>
              <span className={styles.subtotalValue}>{row.matchesPoints}</span>
            </div>
            <div className={styles.subtotal}>
              <span className={styles.subtotalLabel}>Bracket</span>
              <span className={styles.subtotalValue}>{row.bracketPoints}</span>
            </div>
            <div className={styles.subtotal}>
              <span className={styles.subtotalLabel}>Paris</span>
              <span className={styles.subtotalValue}>{row.betsPoints}</span>
            </div>
            <div className={styles.subtotal}>
              <span className={styles.subtotalLabel}>Forme (7 j)</span>
              <span className={styles.subtotalValue}>{row.formPoints}</span>
            </div>
          </div>

          {/* « dont Écarts » vit dans l'expansion, pas en 6e puce (§6). */}
          <p className={styles.exactMargins}>dont {pluralExactMargins(row.exactMarginsCount)}</p>

          {row.adminCorrectionsCount > 0 && (
            <p className={styles.correctionLine}>
              {plural(row.adminCorrectionsCount, "élément")} corrigé
              {row.adminCorrectionsCount > 1 ? "s" : ""} par un admin, sur requête
            </p>
          )}
        </div>
      )}
    </div>
  );
}
