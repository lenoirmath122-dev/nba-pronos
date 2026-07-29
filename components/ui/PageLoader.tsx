import { Spinner } from "./Spinner";
import styles from "./PageLoader.module.css";

// Fallback partagé par les loading.tsx de segments de route : occupe la
// zone de contenu (la nav/le layout englobant, eux, ne se démontent pas).
export function PageLoader() {
  return (
    <div className={styles.wrap}>
      <Spinner size="lg" />
    </div>
  );
}
