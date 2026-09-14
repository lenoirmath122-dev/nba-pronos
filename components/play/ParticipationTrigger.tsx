"use client";

import { useState } from "react";
import type { OtherPrediction } from "@/lib/queries/play";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { PeopleIcon } from "@/components/icons/play-icons";
import { RevealPanelUpcoming } from "./RevealPanelUpcoming";
import styles from "./ParticipationTrigger.module.css";

// Déclencheur compact du bandeau participation (14/09/2026, remplace
// l'ancien bandeau texte toujours visible en bas de carte) : une icône
// sociale seule, dans la même colonne étroite que l'icône pari — le
// contenu (compteur X/Y, liste des autres/absents) ne s'affiche plus qu'en
// popup, à la demande explicite de l'utilisateur (garder la colonne étroite
// SANS texte, plutôt qu'un bandeau pleine largeur toujours visible).
// RevealPanelUpcoming lui-même n'est PAS modifié : seule sa présentation
// (toujours visible -> sur demande) change, sa logique (isRevealed,
// others/absentees) reste intacte.
type ParticipationTriggerProps = {
  isRevealed: boolean;
  predictedCount: number;
  eligibleCount: number;
  others: OtherPrediction[];
  absentees: string[];
};

export function ParticipationTrigger({
  isRevealed,
  predictedCount,
  eligibleCount,
  others,
  absentees,
}: ParticipationTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const label = `Participation : ${predictedCount}/${eligibleCount} ont pronostiqué`;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)} aria-label={label}>
        <PeopleIcon size={14} aria-hidden="true" />
      </button>
      {isOpen && (
        <ModalDialog title="Participation" onClose={() => setIsOpen(false)}>
          <div className={styles.modalContent}>
            <RevealPanelUpcoming
              isRevealed={isRevealed}
              predictedCount={predictedCount}
              eligibleCount={eligibleCount}
              others={others}
              absentees={absentees}
            />
          </div>
        </ModalDialog>
      )}
    </>
  );
}
