import Link from "next/link";
import styles from "./page.module.css";

// TEMPORAIRE (24/07/2026) — hub "Jouer" minimal, posé uniquement pour
// disposer d'un chemin de navigation vers l'écran Matchs (déjà codé mais
// jusqu'ici inaccessible depuis l'UI). Le vrai hub (spec d'écran dédiée,
// hors périmètre de ce lot) le remplacera entièrement. À retirer alors ;
// voir GAPS_OUVERTS.md.
const ENTRIES = [
  { label: "Matchs", href: "/play/matches" },
  { label: "Mes pronos", href: "/play/my-predictions" },
  { label: "Mon bracket", href: null },
  { label: "Paris", href: null },
] as const;

export default function PlayPage() {
  return (
    <div className={styles.page}>
      <p className={styles.notice}>Hub temporaire — sera remplacé.</p>
      <ul className={styles.list}>
        {ENTRIES.map((entry) => (
          <li key={entry.label}>
            {entry.href ? (
              <Link href={entry.href} className={styles.entry}>
                {entry.label}
              </Link>
            ) : (
              <span className={styles.entryInert}>
                {entry.label}
                <span className={styles.soon}>à venir</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
