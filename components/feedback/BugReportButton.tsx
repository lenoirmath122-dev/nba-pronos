"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { submitBugReport } from "@/lib/actions/bug-reports";
import styles from "./BugReportButton.module.css";

// Bouton flottant "Signaler" (28/08/2026, migration #33) — présent sur tout
// l'espace joueur (app/(app)/layout.tsx), demandé par l'utilisateur pour
// l'alpha/bêta : la crainte n'est pas l'absence de canal (le chat existe
// déjà), mais qu'un petit souci ne franchisse jamais le seuil "ça vaut le
// coup d'envoyer un DM" — un bouton toujours visible, 1 tap, capture ce qui
// se perdrait sinon. Volontairement texte seul (pas de capture d'écran,
// décision utilisateur) : le contexte (joueur via la session, écran via
// usePathname, heure) est déjà capturé automatiquement.

export function BugReportButton() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setIsOpen(false);
    // Repli différé (pas immédiat) : évite un flash "formulaire vide" visible
    // pendant l'animation de fermeture du dialogue.
    setTimeout(() => {
      setDescription("");
      setError(null);
      setSent(false);
    }, 200);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBugReport({ description, screenPath: pathname });
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setIsOpen(true)}
        aria-label="Signaler un souci"
        title="Signaler un souci"
      >
        !
      </button>
      {isOpen && (
        <ModalDialog title="Signaler un souci" onClose={handleClose}>
          <div className={styles.content}>
            {sent ? (
              <p className={styles.sent}>Merci, c&apos;est noté 🙏</p>
            ) : (
              <>
                <p className={styles.hint}>
                  Un bug, un truc pas clair, une idée — même petit, ça nous aide.
                </p>
                <textarea
                  className={styles.textarea}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex. Le bouton Valider ne réagit pas sur cet écran"
                  rows={4}
                  autoFocus
                />
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  className={styles.submit}
                  onClick={handleSubmit}
                  disabled={isPending || description.trim().length === 0}
                >
                  Envoyer
                </button>
              </>
            )}
          </div>
        </ModalDialog>
      )}
    </>
  );
}
