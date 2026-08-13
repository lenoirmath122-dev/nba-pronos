"use client";

import { useState } from "react";
import type { LeaderboardRow as RowData, RankTrend, SortKey } from "@/lib/queries/leaderboard";
import { PlayerLink } from "@/components/ui/PlayerLink";
import styles from "./LeaderboardRow.module.css";

// Une ligne du classement (§6/§7) : SEULE responsabilité client de cet écran
// avec StickyMeBar — expansion/repli, rien d'autre. Le badge de correction
// porte l'infobulle native du navigateur (`title`) sur desktop ; sur mobile
// il n'y a pas de hover, donc pas d'infobulle : le tap déplie déjà la ligne
// via le bouton (§7, aucune logique dédiée nécessaire). Même patron repris
// pour le badge de tendance de rang (13/08/2026, ci-dessous).
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

function ordinal(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

// Initiales avatar (13/08/2026) : repère visuel rapide, propre à cet écran
// (pas ajouté à PlayerLink lui-même, utilisé sur d'autres écrans où ça n'a
// pas été demandé). Coupe sur le 1er séparateur usuel (_, -, espace) si
// présent, sinon les 2 premiers caractères — les pseudos de ce projet ne
// suivent aucune convention "Prénom Nom".
function getInitials(pseudo: string): string {
  const parts = pseudo.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return pseudo.slice(0, 2).toUpperCase();
}

function trendTitle(trend: RankTrend): string {
  switch (trend.kind) {
    case "up":
      return `Hier : ${ordinal(trend.previousRank)} — a progressé de ${trend.delta} place${trend.delta > 1 ? "s" : ""}`;
    case "down":
      return `Hier : ${ordinal(trend.previousRank)} — a reculé de ${trend.delta} place${trend.delta > 1 ? "s" : ""}`;
    case "flat":
      return "Même rang qu'hier";
    case "unavailable":
      return "Pas d'historique de rang avant aujourd'hui";
  }
}

function trendLine(trend: RankTrend): string {
  // Même texte que le title, mais TOUJOURS lisible (expansion) — le title
  // natif n'existe pas au tap sur mobile, même raison que le badge correction.
  return trendTitle(trend);
}

function TrendBadge({ trend }: { trend: RankTrend }) {
  const title = trendTitle(trend);
  if (trend.kind === "up") {
    return (
      <span className={styles.trendUp} title={title}>
        ▲{trend.delta}
      </span>
    );
  }
  if (trend.kind === "down") {
    return (
      <span className={styles.trendDown} title={title}>
        ▼{trend.delta}
      </span>
    );
  }
  if (trend.kind === "flat") {
    return (
      <span className={styles.trendFlat} title={title}>
        =
      </span>
    );
  }
  return (
    <span className={styles.trendFlat} title={title}>
      –
    </span>
  );
}

export function LeaderboardRow({ row, sortKey }: LeaderboardRowProps) {
  const [expanded, setExpanded] = useState(false);

  const correctionTitle =
    row.adminCorrectionsCount > 0
      ? `${plural(row.adminCorrectionsCount, "élément")} corrigé${row.adminCorrectionsCount > 1 ? "s" : ""} par un admin, sur requête`
      : undefined;

  // Top 3 (13/08/2026) : filet d'accent en dégradé d'opacité, PAS d'or —
  // --color-champion est réservé au champion du bracket (§17), "nulle part
  // ailleurs". Clé sur la VALEUR du rang (pas l'index de ligne) : des
  // ex-aequo au rang 2 partagent la même émphase, cohérent avec la
  // numérotation sportive 1,2,2,4 (§9).
  const topRank = row.rank <= 3 ? row.rank : undefined;

  // Restructuré le 30/07/2026 (bouton -> div) : le pseudo devient un vrai
  // <Link> vers /players/[userId] (demandé par l'utilisateur, actif sur
  // toutes les pages) — un <a> imbriqué dans un <button> est invalide en
  // HTML, d'où le passage à un conteneur cliquable non-bouton, avec le
  // même comportement clavier (Entrée/Espace) reconstitué à la main.
  return (
    <div
      className={row.isInactive ? `${styles.wrapper} ${styles.rowInactive}` : styles.wrapper}
      data-top-rank={topRank}
    >
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
        <span className={styles.colRank}>
          <span className={topRank ? styles.rankNum : undefined}>{row.rank}</span>
          {row.rankTrend && <TrendBadge trend={row.rankTrend} />}
        </span>

        <span className={styles.colPlayer}>
          <span className={styles.avatar} aria-hidden="true">
            {getInitials(row.pseudo)}
          </span>
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

          {/* Tendance en clair (13/08/2026) : même raison que la correction
              ci-dessous — le title du badge n'existe pas au tap mobile. */}
          {row.rankTrend && <p className={styles.trendLine}>{trendLine(row.rankTrend)}</p>}

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
