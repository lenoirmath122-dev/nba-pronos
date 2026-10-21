"use client";

import { createPortal } from "react-dom";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { Backdrop } from "@/components/ui/Backdrop";
import { Spinner } from "@/components/ui/Spinner";
import styles from "./UpcomingRow.module.css";

// Dialogue de VALIDATION d'un prono, extrait d'UpcomingRow le 22/10/2026 pour
// être partagé avec la carte « Prochain prono » de l'Accueil. Distinct du
// dialogue C2 de perte de saisie : wording et déclencheur différents, ne pas
// fusionner. Portalé vers document.body (20/09/2026) : la carte porte
// .glass-card, dont le backdrop-filter (thème Photo) crée un contexte
// d'empilement qui piégeait le backdrop position:fixed à l'intérieur de la
// carte — même raison/fix que ModalDialog. Styles : ceux d'UpcomingRow (une
// seule source pour l'apparence des boutons du dialogue).

export function PendingLabel({ label }: { label: string }) {
  return (
    <span className={styles.pendingLabel}>
      <Spinner size="sm" />
      {label}
    </span>
  );
}

type ValidateConfirmDialogProps = {
  matchId: string;
  isUnsaved: boolean;
  isPending: boolean;
  pendingAction: "draft" | "validate" | null;
  onClose: () => void;
  onSaveDraft: () => void;
  onValidate: () => void;
  onValidateDefinitively: () => void;
};

export function ValidateConfirmDialog({
  matchId,
  isUnsaved,
  isPending,
  pendingAction,
  onClose,
  onSaveDraft,
  onValidate,
  onValidateDefinitively,
}: ValidateConfirmDialogProps) {
  return createPortal(
    <Backdrop className={styles.backdrop} onClose={onClose}>
      <FocusTrap
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`validate-title-${matchId}`}
        onClose={onClose}
      >
        <p id={`validate-title-${matchId}`} className={styles.dialogTitle}>
          Valider ce prono ?
        </p>
        {isUnsaved ? (
          <>
            <p className={styles.dialogBody}>
              Attention, ton brouillon n&rsquo;est pas encore enregistré. Une fois validé, le prono
              n&rsquo;est plus modifiable — enregistre-le d&rsquo;abord si tu veux pouvoir revenir dessus.
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogCancel} onClick={onClose} disabled={isPending}>
                Retour
              </button>
              <button type="button" className={styles.dialogSecondary} onClick={onSaveDraft} disabled={isPending}>
                {isPending && pendingAction === "draft" ? (
                  <PendingLabel label="Enregistrement…" />
                ) : (
                  "Enregistrer le brouillon"
                )}
              </button>
              <button type="button" className={styles.dialogConfirm} onClick={onValidateDefinitively} disabled={isPending}>
                {isPending && pendingAction === "validate" ? <PendingLabel label="Validation…" /> : "Valider définitivement"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.dialogBody}>
              Une fois validé, il n&rsquo;est plus modifiable — et tu verras (comme les autres joueurs) les
              pronos déjà déposés sur ce match.
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.dialogCancel} onClick={onClose} disabled={isPending}>
                Annuler
              </button>
              <button type="button" className={styles.dialogConfirm} onClick={onValidate} disabled={isPending}>
                {isPending && pendingAction === "validate" ? <PendingLabel label="Validation…" /> : "Valider"}
              </button>
            </div>
          </>
        )}
      </FocusTrap>
    </Backdrop>,
    document.body
  );
}
