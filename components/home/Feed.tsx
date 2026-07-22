import type { FeedItem } from "@/lib/queries/home";
import { FeedRow } from "./FeedRow";
import styles from "./Feed.module.css";

// Feed « Ça vient de tomber » (§6) : événements déjà filtrés (fenêtre
// FEED_WINDOW_HOURS), triés (plus récent d'abord) et bornés (FEED_MAX_ITEMS)
// par lib/queries/home.ts.
type FeedProps = {
  items: FeedItem[];
};

export function Feed({ items }: FeedProps) {
  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        // Pas d'id stable en base pour un item de feed (agrégat de 3 sources) ;
        // l'ordre, déjà trié, suffit comme clé de rendu d'une liste figée par requête.
        <FeedRow key={`${item.kind}-${item.occurredAt}-${index}`} item={item} />
      ))}
    </ul>
  );
}
