"use client";

import { useState } from "react";
import { markTutorialSeen } from "@/lib/actions/tutorial";
import { TutorialModal } from "./TutorialModal";
import styles from "./TutorialBanner.module.css";

// Proposition unique du tutoriel à la 1re connexion (SPEC_TUTORIEL_JOUEUR_V0_1
// §1) — le parent (Accueil) ne monte ce composant QUE si
// profile.tutorialSeenAt === null (gate côté serveur, jamais recalculé ici).
// `dismissed` masque la bannière immédiatement côté client dans les 3 cas de
// sortie (Découvrir, Plus tard, fermeture du wizard), sans attendre un
// rechargement complet de page — l'écriture serveur (§4) suit en tâche de
// fond, non bloquante : un échec réseau isolé n'est pas assez grave pour
// bloquer l'UI (au pire, la bannière réapparaîtra à la prochaine connexion).

export function TutorialBanner() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function discover() {
    setOpen(true);
    void markTutorialSeen();
  }

  function later() {
    setDismissed(true);
    void markTutorialSeen();
  }

  function closeModal() {
    setOpen(false);
    setDismissed(true);
    void markTutorialSeen();
  }

  return (
    <>
      <section className={styles.banner} aria-label="Découvrir comment jouer">
        <div className={styles.text}>
          <p className={styles.title}>Nouveau ici ?</p>
          <p className={styles.subtitle}>Découvre comment jouer en 7 étapes.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={later}>
            Plus tard
          </button>
          <button type="button" className={styles.primaryButton} onClick={discover}>
            Découvrir
          </button>
        </div>
      </section>

      <TutorialModal open={open} onClose={closeModal} />
    </>
  );
}
