import type { LastWeekChampions } from "@/lib/queries/weeklyLeaderboard";
import { formatChampionNames } from "@/lib/weekly/currentWeek";
import styles from "./WeeklyChampionBanner.module.css";

// Champion(s) de la dernière semaine figée (lot 2 du classement hebdo).
// Rendu seul : la donnée vient de getWeeklyLeaderboard. Masqué (null) quand la
// semaine figée n'a pas de champion ou en portée ligue (weekly_champions est
// global).
type WeeklyChampionBannerProps = { lastChampions: LastWeekChampions };

export function WeeklyChampionBanner({ lastChampions }: WeeklyChampionBannerProps) {
  if (!lastChampions || lastChampions.champions.length === 0) return null;
  const { champions } = lastChampions;
  const points = champions[0].points;

  return (
    <div className={`${styles.banner} glass-card`}>
      <p className={styles.label}>{champions.length > 1 ? "Champions de la semaine dernière" : "Champion de la semaine dernière"}</p>
      <p className={styles.names}>{formatChampionNames(champions.map((champion) => champion.pseudo))}</p>
      <p className={styles.points}>
        {points} pt{points > 1 ? "s" : ""}
      </p>
    </div>
  );
}
