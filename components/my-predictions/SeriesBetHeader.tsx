import type { SeriesBetHeader as SeriesBetHeaderData } from "@/lib/queries/my-predictions";
import { AssociatedBetCard } from "./AssociatedBetCard";
import { OtherBetsModal } from "./OtherBetsModal";
import styles from "./SeriesBetHeader.module.css";

// En-tête de pari SERIES (§11.2) — UNIQUEMENT visible en mode FILTERED sur une
// série. Un pari SERIES n'a pas de match_id : il porte sur la série entière,
// donc pas de ligne de match où le loger — d'où cet en-tête séparé, au-dessus
// de la liste, plutôt qu'une répétition sur chaque ligne de match.

type SeriesBetHeaderProps = { header: SeriesBetHeaderData };

export function SeriesBetHeader({ header }: SeriesBetHeaderProps) {
  return (
    <div className={`${styles.wrap} glass-card`}>
      <p className={styles.label}>
        Ton pari sur cette série : <span className={styles.series}>{header.seriesLabel}</span>
      </p>
      {header.bet ? (
        <AssociatedBetCard bet={header.bet} />
      ) : (
        <p className={styles.empty}>Aucun pari posé sur cette série.</p>
      )}
      <OtherBetsModal bets={header.otherBets} />
    </div>
  );
}
