import type { TodoItem } from "@/lib/queries/home";
import { Countdown } from "./Countdown";
import styles from "./TodoRow.module.css";

// Un item du bloc « À traiter » (§4). Le tri, les libellés et la condition
// d'apparition sont déjà décidés par lib/queries/home.ts ; ce composant se
// contente de rendre l'item, avec ou sans compte à rebours.
type TodoRowProps = {
  item: TodoItem;
};

export function TodoRow({ item }: TodoRowProps) {
  const isAdmin = item.kind === "admin_bet_review";

  const body = (
    <>
      <div className={styles.text}>
        <p className={styles.title}>
          {item.title}
          {isAdmin && <span className={styles.adminTag}>admin</span>}
        </p>
        {item.subtitle && <p className={styles.subtitle}>{item.subtitle}</p>}
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
    <Countdown deadline={item.deadline} href={item.href}>
      {body}
    </Countdown>
  );
}
