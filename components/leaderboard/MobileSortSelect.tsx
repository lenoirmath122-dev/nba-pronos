"use client";

import { useRouter } from "next/navigation";
import type { SortDirection, SortKey } from "@/lib/queries/leaderboard";
import styles from "./MobileSortSelect.module.css";

// Sélecteur de colonne de détail — MOBILE UNIQUEMENT (masqué en desktop par
// LeaderboardTable.module.css). Remplace l'ancienne rangée de puces
// SortChips (retirée le 13/08/2026, spec §4.2 corrigée : les en-têtes
// portent maintenant eux-mêmes le tri, cf. LeaderboardTable.tsx) pour le cas
// où l'écran est trop étroit pour afficher les 4 en-têtes de détail : sans
// lui, seul l'en-tête de la colonne DÉJÀ active resterait visible (règle
// existante masquant .colDetail:not(.colActive)), sans aucun moyen de la
// changer sur mobile.
//
// Ne pilote QUE la 3e colonne (Matchs/Bracket/Paris/Forme) — jamais Total,
// qui garde sa propre colonne fixe ET son propre en-tête <Link> TOUJOURS
// visible (même sur mobile, cf. §4) : sa bascule croissant/décroissant se
// fait donc déjà en tapant directement dessus, rien à ajouter ici pour lui.
//
// Bascule croissant/décroissant (14/08/2026) : bouton séparé à côté du
// select — un <select> seul n'a pas de notion naturelle de "sens", contrairement
// à un en-tête qu'on peut re-taper. N'apparaît que si une colonne de détail
// (pas Total) est réellement active.

const OPTIONS: { key: Exclude<SortKey, "total">; label: string }[] = [
  { key: "matches", label: "Matchs" },
  { key: "bracket", label: "Bracket" },
  { key: "bets", label: "Paris" },
  { key: "form", label: "Forme" },
];

type MobileSortSelectProps = {
  active: SortKey;
  direction: SortDirection;
  leagueId: string | null;
};

export function MobileSortSelect({ active, direction, leagueId }: MobileSortSelectProps) {
  const router = useRouter();
  // Repli sur "matches" quand le tri actif est "total" : sur mobile, ce cas
  // n'affiche déjà aucune 3e colonne (les 4 masquées par .colActive absent)
  // — la valeur du select ne fait alors que proposer un point de départ
  // cohérent, elle ne prétend pas qu'une colonne est déjà active.
  const value: Exclude<SortKey, "total"> = active === "total" ? "matches" : active;

  function navigate(key: string, nextDirection: SortDirection) {
    const params = new URLSearchParams();
    params.set("tri", key);
    if (nextDirection === "asc") params.set("ordre", "asc");
    if (leagueId) params.set("ligue", leagueId);
    router.push(`/leaderboard?${params.toString()}`);
  }

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    // Changer de colonne repart en décroissant (même repli que desktop) —
    // le sens d'une AUTRE colonne n'a pas de raison de survivre au changement.
    navigate(event.target.value, "desc");
  }

  function handleToggleDirection() {
    navigate(active, direction === "desc" ? "asc" : "desc");
  }

  return (
    <span className={styles.wrapper}>
      <select
        className={styles.select}
        value={value}
        onChange={handleChange}
        aria-label="Colonne de détail affichée"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
      {active !== "total" && (
        <button
          type="button"
          className={styles.directionButton}
          onClick={handleToggleDirection}
          aria-label={direction === "desc" ? "Passer en ordre croissant" : "Passer en ordre décroissant"}
        >
          {direction === "asc" ? "▴" : "▾"}
        </button>
      )}
    </span>
  );
}
