import Link from "next/link";
import type { LeaderboardRow as RowData, SortDirection, SortKey } from "@/lib/queries/leaderboard";
import { LeaderboardRow } from "./LeaderboardRow";
import { MobileSortSelect } from "./MobileSortSelect";
import styles from "./LeaderboardTable.module.css";

// Tableau du classement (§3/§4) : ordre des colonnes et rang déjà figés par
// lib/queries/leaderboard.ts, ce composant ne fait que rendre l'en-tête et
// déléguer chaque ligne à LeaderboardRow (seule feuille client, expand/repli).
//
// En-têtes CLIQUABLES (13/08/2026, corrige §4.2 — décision reconnue erronée
// par l'utilisateur) : remplacent l'ancienne rangée SortChips séparée, qui
// affichait exactement les mêmes libellés (Total/Matchs/Bracket/Paris/Forme)
// une 2e fois juste au-dessus.
//
// Bascule croissant/décroissant (14/08/2026, demandée après coup — comportement
// de tableur attendu) : cliquer un en-tête DÉJÀ actif inverse le sens ; cliquer
// un en-tête différent bascule dessus en décroissant (repli habituel, même
// affichage qu'avant l'ajout de la bascule). ▾ = décroissant, ▴ = croissant.
type LeaderboardTableProps = {
  rows: RowData[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  leagueId: string | null;
};

const DETAIL_COLUMNS: { key: Exclude<SortKey, "total">; label: string }[] = [
  { key: "matches", label: "Matchs" },
  { key: "bracket", label: "Bracket" },
  { key: "bets", label: "Paris" },
  { key: "form", label: "Forme" },
];

function nextDirection(key: SortKey, activeKey: SortKey, activeDirection: SortDirection): SortDirection {
  if (key !== activeKey) return "desc";
  return activeDirection === "desc" ? "asc" : "desc";
}

function sortHref(key: SortKey, direction: SortDirection, leagueId: string | null): string {
  const params = new URLSearchParams();
  if (key !== "total") params.set("tri", key);
  if (direction === "asc") params.set("ordre", "asc");
  if (leagueId) params.set("ligue", leagueId);
  const query = params.toString();
  return query ? `/leaderboard?${query}` : "/leaderboard";
}

function Caret({ direction }: { direction: SortDirection }) {
  return (
    <span className={styles.caret} aria-hidden="true">
      {direction === "asc" ? "▴" : "▾"}
    </span>
  );
}

export function LeaderboardTable({ rows, sortKey, sortDirection, leagueId }: LeaderboardTableProps) {
  return (
    <div className={styles.table} role="table" aria-label="Classement">
      <div className={styles.headerRow} role="row">
        <span className={styles.colRank} role="columnheader">
          Rang
        </span>
        <span className={styles.colPlayer} role="columnheader">
          Joueur
        </span>
        <Link
          href={sortHref("total", nextDirection("total", sortKey, sortDirection), leagueId)}
          role="columnheader"
          aria-sort={sortKey === "total" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
          className={sortKey === "total" ? `${styles.colTotal} ${styles.totalBand} ${styles.sortLink}` : `${styles.colTotal} ${styles.sortLink}`}
        >
          Total
          {sortKey === "total" && <Caret direction={sortDirection} />}
        </Link>

        {/* Desktop : les 4 en-têtes de détail sont chacun un lien de tri.
            Mobile : masqués sauf l'actif (règle existante), et remplacés par
            MobileSortSelect (ci-dessous) pour rester changeables malgré ça. */}
        <div className={styles.detailHeaders}>
          {DETAIL_COLUMNS.map((col) => {
            const isActive = col.key === sortKey;
            return (
              <Link
                key={col.key}
                href={sortHref(col.key, nextDirection(col.key, sortKey, sortDirection), leagueId)}
                role="columnheader"
                aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                className={isActive ? `${styles.colDetail} ${styles.colActive} ${styles.sortLink}` : `${styles.colDetail} ${styles.sortLink}`}
              >
                {col.label}
                {isActive && <Caret direction={sortDirection} />}
              </Link>
            );
          })}
        </div>

        <div className={styles.mobileSortSlot}>
          <MobileSortSelect active={sortKey} direction={sortDirection} leagueId={leagueId} />
        </div>

        {/* Espace réservé, largeur = .chevron de LeaderboardRow (1rem) : sans
            lui, .colPlayer (flex:1) calcule une largeur différente entre la
            rangée d'en-tête et les rangées de données (bug réel trouvé le
            14/08/2026, cf. .chevron). */}
        <span className={styles.chevronSpace} aria-hidden="true" />
      </div>

      <div role="rowgroup">
        {rows.map((row) => (
          <LeaderboardRow key={row.userId} row={row} sortKey={sortKey} />
        ))}
      </div>
    </div>
  );
}
