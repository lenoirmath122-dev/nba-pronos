import type { TodoItem } from "@/lib/queries/home";
import { Countdown } from "@/components/ui/Countdown";
import { TeamLogo } from "@/components/ui/TeamLogo";
import { BracketIcon, BetsIcon, AdminFlagIcon } from "@/components/icons/home-icons";
import { PlayIcon } from "@/components/icons/nav-icons";
import styles from "./TodoRow.module.css";

// Un item du bloc « À traiter » (§4). Le tri, les libellés et la condition
// d'apparition sont déjà décidés par lib/queries/home.ts ; ce composant se
// contente de rendre l'item, avec ou sans compte à rebours.
type TodoRowProps = {
  item: TodoItem;
};

// Icône par nature d'action (polish visuel, ne change aucune règle) —
// PlayIcon (ballon) réutilisée telle quelle depuis la nav plutôt que
// dupliquée : même motif basketball, même famille de trait.
const ICON_BY_KIND = {
  bracket: BracketIcon,
  matches: PlayIcon,
  bets: BetsIcon,
  admin_bet_review: AdminFlagIcon,
} as const;

export function TodoRow({ item }: TodoRowProps) {
  const isAdmin = item.kind === "admin_bet_review";
  const Icon = ICON_BY_KIND[item.kind];

  const body = (
    <>
      <span className={isAdmin ? styles.iconAdmin : styles.icon} aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>
          {item.title}
          {isAdmin && <span className={styles.adminTag}>admin</span>}
        </p>
        {item.matchup ? (
          <p className={styles.matchup}>
            <span>Prochain :</span>
            <TeamLogo
              abbreviation={item.matchup.home.abbreviation}
              alt={item.matchup.home.name}
              size={16}
            />
            <span>{item.matchup.home.abbreviation}</span>
            <span aria-hidden="true">–</span>
            <TeamLogo
              abbreviation={item.matchup.away.abbreviation}
              alt={item.matchup.away.name}
              size={16}
            />
            <span>{item.matchup.away.abbreviation}</span>
          </p>
        ) : (
          item.subtitle && <p className={styles.subtitle}>{item.subtitle}</p>
        )}
      </div>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </>
  );

  // Item admin : pas de deadline (compte d'éléments, pas d'urgence chronométrée).
  if (item.deadline === null) {
    return (
      <a href={item.href} className={isAdmin ? styles.rowAdmin : styles.row}>
        {body}
      </a>
    );
  }

  return (
    <Countdown deadline={item.deadline} href={item.href} urgencyBorder>
      {body}
    </Countdown>
  );
}
