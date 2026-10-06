import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

// État vide générique (SPEC_ECRAN_ACCUEIL §8) : libellés fournis par l'appelant
// (page.tsx), ce composant ne fait que les rendre.
type EmptyStateProps = {
  title: string;
  subtitle: string;
  /** Lien optionnel sous le sous-titre. */
  action?: ReactNode;
};

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>{title}</p>
      <p className={styles.subtitle}>{subtitle}</p>
      {action && <p className={styles.subtitle}>{action}</p>}
    </div>
  );
}
