"use client";

import { useState, useTransition } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { submitChatMessageReport } from "@/lib/actions/chat-reports";
import styles from "./ReportMessageButton.module.css";

// Bouton "Signaler" par message (03/09/2026, migration 20260903130000,
// cadrage juridique §2.10 point 7) -- même patron modal + useTransition que
// BugReportButton.tsx, mais scopé à UN message (messageId) plutôt qu'un
// signalement général. Volontairement séparé de ChatMessageRow (comme
// ChatNotificationToggle l'est de ChatChannelList) pour ne pas alourdir la
// ligne de message avec l'état du dialogue.

type ReportMessageButtonProps = {
  messageId: string;
};

export function ReportMessageButton({ messageId }: ReportMessageButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setIsOpen(false);
    setTimeout(() => {
      setReason("");
      setError(null);
      setSent(false);
    }, 200);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitChatMessageReport({ messageId, reason });
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
        className={styles.reportButton}
        onClick={() => setIsOpen(true)}
        aria-label="Signaler ce message"
      >
        Signaler
      </button>
      {isOpen && (
        <ModalDialog title="Signaler ce message" onClose={handleClose}>
          <div className={styles.content}>
            {sent ? (
              <p className={styles.sent}>Merci, un admin va regarder ça.</p>
            ) : (
              <>
                <p className={styles.hint}>Explique brièvement pourquoi ce message pose problème.</p>
                <textarea
                  className={styles.textarea}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex. Propos injurieux envers un autre joueur"
                  rows={3}
                  maxLength={500}
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
                  disabled={isPending || reason.trim().length === 0}
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
