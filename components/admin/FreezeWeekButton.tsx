"use client";

import { useState, useTransition } from "react";
import { freezeWeeklyRanking } from "@/lib/actions/admin-competitions";
import styles from "./FreezeWeekButton.module.css";

// Bouton « Figer la semaine » (classement hebdo, lot 1) : même fonction que le
// cron, idempotente (une semaine déjà figée n'est jamais recalculée). Pas de
// dialogue : relancer ne change rien, et le retour dit ce qui s'est passé.
// L'envoi du récap hebdo n'est PAS déclenché ici (SendWeeklyRecapButton).

export function FreezeWeekButton() {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await freezeWeeklyRanking();
      setFeedback(
        result.success ? { ok: true, text: result.message } : { ok: false, text: result.error },
      );
    });
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.button} onClick={handleClick} disabled={isPending}>
        {isPending ? "Figement en cours…" : "Figer la semaine"}
      </button>
      {feedback && (
        <p className={feedback.ok ? styles.success : styles.error} role={feedback.ok ? "status" : "alert"}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
