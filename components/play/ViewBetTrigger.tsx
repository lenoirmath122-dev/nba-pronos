"use client";

import { useState } from "react";
import type { PlayAssociatedBet } from "@/lib/queries/play";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { BetsIcon } from "@/components/icons/home-icons";
import { BetBlock } from "./BetBlock";
import styles from "./ViewBetTrigger.module.css";

// Déclencheur compact pour un pari déjà posé mais NON éditable ici (statut
// ≠ DRAFT/SUBMITTED -- validé, refusé, gagné, perdu, neutralisé) — 16/09/2026,
// demandé par l'utilisateur : avant, ce cas affichait BetBlock en PLEIN CADRE
// directement dans la carte (toujours visible), ce qui alourdissait la carte
// "de base" (équipes + prono). Même icône/gabarit que le déclencheur éditable
// (InlineBetForm compactTrigger), mais ouvre BetBlock en lecture seule dans
// une popup au lieu de le déplier dans la carte — le bouton reste donc
// toujours visible et cliquable, pari validé ou non.
type ViewBetTriggerProps = {
  bet: PlayAssociatedBet;
};

export function ViewBetTrigger({ bet }: ViewBetTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)} aria-label="Voir le pari">
        <BetsIcon size={14} aria-hidden="true" />
      </button>
      {isOpen && (
        <ModalDialog title="Ton pari" onClose={() => setIsOpen(false)}>
          <div className={styles.modalContent}>
            <BetBlock bet={bet} returnTo="/play" />
          </div>
        </ModalDialog>
      )}
    </>
  );
}
