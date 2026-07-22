import Link from "next/link";
import type { SortKey } from "@/lib/queries/leaderboard";
import styles from "./SortChips.module.css";

// Puces de tri (§5) : pas d'état client — paramètre d'URL `?tri=`, rendu en
// <Link> côté serveur. L'écran reste serveur, l'URL reste partageable.
const CHIPS: { key: SortKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "matches", label: "Matchs" },
  { key: "bracket", label: "Bracket" },
  { key: "bets", label: "Paris" },
  { key: "form", label: "Forme" },
];

type SortChipsProps = {
  active: SortKey;
};

export function SortChips({ active }: SortChipsProps) {
  return (
    <nav className={styles.chips} aria-label="Trier le classement">
      {CHIPS.map((chip) => (
        <Link
          key={chip.key}
          href={chip.key === "total" ? "/leaderboard" : `/leaderboard?tri=${chip.key}`}
          className={chip.key === active ? styles.chipActive : styles.chip}
          aria-current={chip.key === active ? "true" : undefined}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
