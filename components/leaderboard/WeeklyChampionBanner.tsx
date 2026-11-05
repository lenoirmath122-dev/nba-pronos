import { BadgeStrip } from "@/components/badges/BadgeStrip";
import type { BadgeDisplay } from "@/lib/queries/badges";
import type { LastWeekChampions } from "@/lib/queries/weeklyLeaderboard";
import styles from "./WeeklyChampionBanner.module.css";

// Champion(s) de la dernière semaine figée (lot 2 du classement hebdo).
// Rendu seul : la donnée vient de getWeeklyLeaderboard. Masqué (null) quand la
// semaine figée n'a pas de champion ou en portée ligue (weekly_champions est
// global).
type WeeklyChampionBannerProps = {
  lastChampions: LastWeekChampions;
  /** Vitrine résolue par champion (Lot 6) ; absente = pas d'écusson. */
  showcases?: Map<string, BadgeDisplay[]>;
};

export function WeeklyChampionBanner({ lastChampions, showcases }: WeeklyChampionBannerProps) {
  if (!lastChampions || lastChampions.champions.length === 0) return null;
  const { champions } = lastChampions;
  const points = champions[0].points;

  return (
    <div className={`${styles.banner} glass-card`}>
      <p className={styles.label}>{champions.length > 1 ? "Champions de la semaine dernière" : "Champion de la semaine dernière"}</p>
      <p className={styles.names}>
        {champions.map((champion, index) => (
          <span key={champion.userId}>
            {index === 0 ? "" : index === champions.length - 1 ? " et " : ", "}
            {champion.pseudo}
            <span className={styles.badge}>
              <BadgeStrip badges={showcases?.get(champion.userId) ?? []} ownerName={champion.pseudo} max={1} />
            </span>
          </span>
        ))}
      </p>
      <p className={styles.points}>
        {points} pt{points > 1 ? "s" : ""}
      </p>
    </div>
  );
}
