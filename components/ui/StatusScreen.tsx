import type { ReactNode } from "react";
import styles from "./StatusScreen.module.css";

// Présentation partagée entre app/not-found.tsx et app/error.tsx (deux
// contextes différents — Server Component vs Error Boundary client — d'où un
// composant sans hooks, réutilisable des deux côtés).
export function StatusScreen({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}
