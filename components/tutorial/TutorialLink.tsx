"use client";

import { useState } from "react";
import { TutorialModal } from "./TutorialModal";
import styles from "./TutorialLink.module.css";

// Lien permanent "Comment jouer ?" (SPEC_TUTORIEL_JOUEUR_V0_1 §1), Profil >
// Compte — relance le même wizard que la bannière Accueil, peu importe
// tutorial_seen_at (déjà vu ou non). Aucune écriture ici : le flag est déjà
// posé la première fois (TutorialBanner) ou n'a pas besoin de l'être (le
// joueur vient consulter volontairement, pas une 1re proposition).

export function TutorialLink() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.link} onClick={() => setOpen(true)}>
        Comment jouer ?
      </button>
      <TutorialModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
