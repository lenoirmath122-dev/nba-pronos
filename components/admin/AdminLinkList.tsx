import Link from "next/link";
import styles from "./AdminHub.module.css";

// Liste de liens des pages de rubrique : carte à compteur (.cardLink) quand
// `count` est fourni, simple entrée (.linkEntryActive) sinon.

export type AdminLinkEntry = { href: string; label: string; count?: number };

export function AdminLinkList({ entries }: { entries: AdminLinkEntry[] }) {
  return (
    <ul className={styles.linkList}>
      {entries.map((entry) => (
        <li key={entry.href}>
          {entry.count === undefined ? (
            <Link href={entry.href} className={styles.linkEntryActive}>
              {entry.label}
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </Link>
          ) : (
            <Link href={entry.href} className={styles.cardLink}>
              <span className={styles.count}>{entry.count}</span>
              <span className={styles.cardLabel}>{entry.label}</span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AdminAlert({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={styles.alert}>
      {children}
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
