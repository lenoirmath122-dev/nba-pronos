import type { WeeklyLeaderboardRow } from "@/lib/queries/weeklyLeaderboard";
import { PlayerIdentity } from "@/components/player/PlayerIdentity";
import type { BadgeDisplay } from "@/lib/queries/badges";
import styles from "./WeeklyLeaderboardList.module.css";

// Classement de la semaine en cours (lot 2 du classement hebdo). Ordre et rang
// déjà figés par computeWeeklyStandings (points, puis bons vainqueurs, puis
// écarts exacts) : aucun tri, aucune tendance, pas d'accordéon. `id="me-row"`
// sur la ligne du joueur connecté, pour StickyMeBar.
type WeeklyLeaderboardListProps = {
  rows: WeeklyLeaderboardRow[];
  showcases: Map<string, BadgeDisplay[]>;
  tiebreakAvailable: boolean;
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

function formatPoints(points: number): string {
  // Signe explicite pour un négatif (correction admin rétroactive) : le moins
  // typographique reste lisible dans une colonne tabulaire.
  return points < 0 ? `−${Math.abs(points)}` : String(points);
}

export function WeeklyLeaderboardList({ rows, showcases, tiebreakAvailable }: WeeklyLeaderboardListProps) {
  return (
    <div className={styles.table} role="table" aria-label="Classement de la semaine">
      <div className={styles.headerRow} role="row">
        <span className={styles.colRank} role="columnheader">
          Rang
        </span>
        <span className={styles.colPlayer} role="columnheader">
          Joueur
        </span>
        <span className={styles.colPoints} role="columnheader">
          Pts semaine
        </span>
      </div>

      {rows.map((row) => (
        <div
          key={row.userId}
          role="row"
          id={row.isCurrentUser ? "me-row" : undefined}
          className={[
            styles.row,
            row.isInactive ? styles.rowInactive : "",
            row.isCurrentUser ? styles.rowMe : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-top-rank={row.rank <= 3 ? row.rank : undefined}
        >
          <span className={styles.colRank} role="cell">
            {row.rank}
          </span>
          <span className={styles.colPlayer} role="cell">
            <PlayerIdentity userId={row.userId} pseudo={row.pseudo} size="row" showcase={showcases.get(row.userId)} maxBadges={3} />
            {row.isInactive && <span className={styles.inactiveTag}>inactif</span>}
            {tiebreakAvailable && row.correctMatchWinners !== null && row.exactMargins !== null && (
              <span className={styles.detail}>
                {plural(row.correctMatchWinners, "bon vainqueur", "bons vainqueurs")} ·{" "}
                {plural(row.exactMargins, "écart exact", "écarts exacts")}
              </span>
            )}
          </span>
          <span className={styles.colPoints} role="cell">
            {formatPoints(row.points)}
          </span>
        </div>
      ))}
    </div>
  );
}
