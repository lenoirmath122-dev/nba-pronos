import Link from "next/link";
import styles from "./page.module.css";

// TEMPORAIRE (24/07/2026) — hub "Jouer" minimal, posé uniquement pour
// disposer d'un chemin de navigation vers les écrans déjà codés (jusqu'ici
// inaccessibles depuis l'UI). Le vrai hub (spec d'écran dédiée, hors
// périmètre de ce lot) le remplacera entièrement. À retirer alors ; voir
// GAPS_OUVERTS.md. Les 4 entrées sont désormais toutes actives (27/07/2026,
// Bracket personnel ferme la dernière) — plus d'entrée inerte à ce jour.
const ENTRIES = [
  { label: "Matchs", href: "/play/matches" },
  { label: "Mes pronos", href: "/play/my-predictions" },
  { label: "Mon bracket", href: "/play/bracket" },
  { label: "Paris", href: "/play/bets" },
] as const;

export default function PlayPage() {
  return (
    <div className={styles.page}>
      <p className={styles.notice}>Hub temporaire — sera remplacé.</p>
      <ul className={styles.list}>
        {ENTRIES.map((entry) => (
          <li key={entry.label}>
            <Link href={entry.href} className={styles.entry}>
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
