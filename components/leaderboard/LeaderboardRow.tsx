"use client";

import { memo } from "react";
import type { LeaderboardRow as RowData, RankTrend, SortKey } from "@/lib/queries/leaderboard";
import { PlayerLink } from "@/components/ui/PlayerLink";
import { clickableRowProps } from "@/lib/hooks/clickableRow";
import styles from "./LeaderboardRow.module.css";

// Une ligne du classement (§6/§7). Composant CONTRÔLÉ depuis LeaderboardRowList
// (15/08/2026, était un useState local ici avant l'accordéon — cf. son
// commentaire d'en-tête pour la raison du déplacement). Le badge de
// correction porte l'infobulle native du navigateur (`title`) sur desktop ;
// sur mobile il n'y a pas de hover, donc pas d'infobulle : le tap déplie déjà
// la ligne via le bouton (§7, aucune logique dédiée nécessaire). Même patron
// repris pour le badge de tendance de rang (13/08/2026, ci-dessous).
type LeaderboardRowProps = {
  row: RowData;
  sortKey: SortKey;
  expanded: boolean;
  onToggle: (userId: string) => void;
};

function detailColClass(column: SortKey, sortKey: SortKey): string {
  return column === sortKey ? `${styles.colDetail} ${styles.colActive}` : styles.colDetail;
}

// Même comparaison que detailColClass, appliquée aux sous-totaux du bandeau
// déplié (15/08/2026) : sur desktop TOUTE la grille est masquée en CSS (déjà
// visible dans la ligne, cf. .subtotals) ; sur mobile seul le sous-total qui
// correspond à la colonne triée fait doublon avec la ligne (colActive y reste
// visible même en dessous de 768px) — les 3 autres restent inédits.
function subtotalClass(column: SortKey, sortKey: SortKey): string {
  return column === sortKey ? `${styles.subtotal} ${styles.subtotalActive}` : styles.subtotal;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

function pluralExactMargins(count: number): string {
  return count > 1 ? `${count} écarts exacts` : `${count} écart exact`;
}

// Ratio paris réussis/tentés + difficulté moyenne entre parenthèses
// (15/08/2026, demandé après coup — même registre que « dont Écarts » :
// inédit, expansion uniquement). "Tenté" = résolu (WON/LOST, cf.
// betsAttempted/lib/queries/leaderboard.ts) — un pari encore en attente de
// résolution n'est pas encore un essai jugé.
function betsSuccessLine(attempted: number, won: number, avgDifficulty: number | null): string {
  if (attempted === 0) return "Aucun pari résolu";
  const ratio = `${won}/${attempted} pari${attempted > 1 ? "s" : ""} réussi${attempted > 1 ? "s" : ""}`;
  if (avgDifficulty === null) return ratio;
  const difficultyText = avgDifficulty.toFixed(1).replace(".", ",");
  return `${ratio} (difficulté moyenne ${difficultyText})`;
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

// Préfixe temporel (16/08/2026, bug d'audit corrigé) : le dernier snapshot
// disponible n'est pas forcément celui d'hier (si le cron quotidien a raté
// un jour) — `daysAgo` (lib/queries/leaderboard.ts) dit la vérité au lieu
// d'afficher "Hier" à tort.
function dayPrefix(daysAgo: number): string {
  return daysAgo <= 1 ? "Hier" : `Il y a ${daysAgo} jours`;
}

function trendTitle(trend: RankTrend): string {
  switch (trend.kind) {
    case "up":
      return `${dayPrefix(trend.daysAgo)} : ${ordinal(trend.previousRank)} — a progressé de ${trend.delta} place${trend.delta > 1 ? "s" : ""}`;
    case "down":
      return `${dayPrefix(trend.daysAgo)} : ${ordinal(trend.previousRank)} — a reculé de ${trend.delta} place${trend.delta > 1 ? "s" : ""}`;
    case "flat":
      return trend.daysAgo <= 1 ? "Même rang qu'hier" : `Même rang il y a ${trend.daysAgo} jours`;
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

// p1-29 (feuille de route Phase 1) : memo() -- combiné à la référence
// stable de `onToggle` posée dans LeaderboardRowList, une ligne dont `row`/
// `expanded`/`sortKey` n'ont pas changé ne se re-rend plus quand une AUTRE
// ligne est dépliée/repliée (avant : les 2 re-rendaient tout l'accordéon,
// closure inline recréée à chaque clic).
export const LeaderboardRow = memo(function LeaderboardRow({ row, sortKey, expanded, onToggle }: LeaderboardRowProps) {
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
  // HTML, d'où le passage à un conteneur cliquable non-bouton.
  return (
    <div
      className={row.isInactive ? `${styles.wrapper} ${styles.rowInactive}` : styles.wrapper}
      data-top-rank={topRank}
    >
      <div
        {...clickableRowProps(() => onToggle(row.userId))}
        id={row.isCurrentUser ? "me-row" : undefined}
        className={styles.row}
        aria-expanded={expanded}
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
            <div className={subtotalClass("matches", sortKey)}>
              <span className={styles.subtotalLabel}>Matchs</span>
              <span className={styles.subtotalValue}>{row.matchesPoints}</span>
            </div>
            <div className={subtotalClass("bracket", sortKey)}>
              <span className={styles.subtotalLabel}>Bracket</span>
              <span className={styles.subtotalValue}>{row.bracketPoints}</span>
            </div>
            <div className={subtotalClass("bets", sortKey)}>
              <span className={styles.subtotalLabel}>Paris</span>
              <span className={styles.subtotalValue}>{row.betsPoints}</span>
            </div>
            <div className={subtotalClass("form", sortKey)}>
              <span className={styles.subtotalLabel}>Forme (7 j)</span>
              <span className={styles.subtotalValue}>{row.formPoints}</span>
            </div>
          </div>

          {/* « dont Écarts » vit dans l'expansion, pas en 6e puce (§6). */}
          <p className={styles.detailLine}>dont {pluralExactMargins(row.exactMarginsCount)}</p>

          {/* Ratio paris + difficulté moyenne (15/08/2026) : même raison que
              ci-dessus, aucun équivalent affiché dans la ligne repliée. */}
          <p className={styles.detailLine}>
            {betsSuccessLine(row.betsAttempted, row.betsWon, row.betsAvgDifficulty)}
          </p>

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
});
