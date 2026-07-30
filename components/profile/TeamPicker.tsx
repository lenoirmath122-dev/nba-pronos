"use client";

import { useState } from "react";
import { TeamLogo } from "@/components/ui/TeamLogo";
import type { TeamOption } from "@/lib/queries/profile";
import styles from "./TeamPicker.module.css";

// Sélecteur d'équipe favorite (SPEC_ECRAN_PROFIL_V0_1 §3/§10), transformé le
// 30/07/2026 (demandé par l'utilisateur : la liste fixe des 30 boutons radio
// prenait trop de place sur la page) en menu DÉROULANT — fermé par défaut,
// ouvert au clic sur le déclencheur. Toujours PAS de <select> natif (ne peut
// pas afficher de logo, piège déjà rencontré §2.15 ETAT_ACTUEL.md) : la liste
// ouverte reste de vrais <input type="radio">, seule leur VISIBILITÉ dépend
// maintenant d'un état d'ouverture — la soumission du formulaire (name=
// "favoriteTeamId") ne change pas. "use client" posé directement sur ce
// composant (même patron que components/ui/TeamLogo.tsx, §2.9 ETAT_ACTUEL.md) :
// son parent (la section Préférences de app/(app)/profile/page.tsx) reste un
// composant serveur.

type TeamPickerProps = {
  teams: TeamOption[];
  selectedTeamId: string | null;
};

export function TeamPicker({ teams, selectedTeamId }: TeamPickerProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(selectedTeamId);

  const selectedTeam = teams.find((t) => t.teamId === selected) ?? null;

  function pick(teamId: string | null) {
    setSelected(teamId);
    setOpen(false);
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.triggerValue}>
          {selectedTeam ? (
            <>
              <TeamLogo abbreviation={selectedTeam.abbreviation} alt={selectedTeam.name} size={24} />
              {selectedTeam.name}
            </>
          ) : (
            "Aucune"
          )}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <div className={styles.list} role="radiogroup" aria-label="Équipe favorite">
          <label className={styles.item}>
            <input
              type="radio"
              name="favoriteTeamId"
              value=""
              defaultChecked={selectedTeamId === null}
              onChange={() => pick(null)}
              className={styles.radio}
            />
            <span className={styles.itemLabel}>Aucune</span>
          </label>
          {teams.map((team) => (
            <label key={team.teamId} className={styles.item}>
              <input
                type="radio"
                name="favoriteTeamId"
                value={team.teamId}
                defaultChecked={team.teamId === selectedTeamId}
                onChange={() => pick(team.teamId)}
                className={styles.radio}
              />
              <TeamLogo abbreviation={team.abbreviation} alt={team.name} size={24} />
              <span className={styles.itemLabel}>{team.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
