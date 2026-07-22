import type { TodoItem } from "@/lib/queries/home";
import { TodoRow } from "./TodoRow";
import styles from "./TodoList.module.css";

// Liste « À traiter » (§4) ou « À traiter (admin) » (§5) : items déjà triés
// par lib/queries/home.ts, ce composant ne fait que les rendre dans l'ordre.
type TodoListProps = {
  items: TodoItem[];
};

export function TodoList({ items }: TodoListProps) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.href}`} className={styles.item}>
          <TodoRow item={item} />
        </li>
      ))}
    </ul>
  );
}
