"use client";

import { useState, useTransition } from "react";
import { sendWeeklyRecap } from "@/lib/actions/admin-competitions";
import styles from "./FreezeWeekButton.module.css";

// Bouton « Envoyer le récap hebdo » (classement hebdo, lot 3) : un push ne se
// reprend pas, d'où la confirmation. Réutilise le style de FreezeWeekButton.
// À utiliser APRÈS « Figer la semaine » (sinon l'action refuse, clairement).

export function SendWeeklyRecapButton() {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Envoyer maintenant le récap de la dernière semaine à tous les joueurs ? Un push ne se reprend pas.")) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await sendWeeklyRecap();
      setFeedback(
        result.success ? { ok: true, text: result.message } : { ok: false, text: result.error },
      );
    });
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.button} onClick={handleClick} disabled={isPending}>
        {isPending ? "Envoi en cours…" : "Envoyer le récap hebdo"}
      </button>
      {feedback && (
        <p className={feedback.ok ? styles.success : styles.error} role={feedback.ok ? "status" : "alert"}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
