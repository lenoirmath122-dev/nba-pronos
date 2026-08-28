"use client";

import { useState } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import styles from "./RuleHelpButton.module.css";

// Bouton d'aide contextuel (28/08/2026, demandé par l'utilisateur —
// accompagnement d'un nouveau joueur EN COMPLÉMENT de /regles, pas un
// nouveau tutoriel comme celui retiré le 21/08/2026 : pas de flag "vu",
// pas de wizard, juste un rappel de règle accessible à la demande, à
// l'endroit où elle s'applique). Même coquille que les autres pop-up du
// dépôt (BetFormModal, InlineBetForm en mode modal) : ModalDialog, portée
// vers document.body, échappe à tout contexte d'empilement ancestral
// (.photo-page). Bouton icône seul (44px, --tap-target-min), même patron
// que ChatNotificationToggle.module.css::.action.
type RuleHelpButtonProps = {
  title: string;
  label?: string;
  children: React.ReactNode;
};

export function RuleHelpButton({ title, label = "Voir la règle", children }: RuleHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setIsOpen(true)}
        aria-label={label}
        title={label}
      >
        ?
      </button>
      {isOpen && (
        <ModalDialog title={title} onClose={() => setIsOpen(false)}>
          <div className={styles.content}>{children}</div>
        </ModalDialog>
      )}
    </>
  );
}
