"use client";

import { useState, useTransition } from "react";
import { sendWeeklyRecap } from "@/lib/actions/admin-competitions";
import styles from "./FreezeWeekButton.module.css";

// Bouton « Envoyer le récap hebdo » (classement hebdo, lot 3) : un push ne se
// reprend pas, d'où la confirmation. Réutilise le style de FreezeWeekButton.
// « M'envoyer un essai » : seul l'admin connecté reçoit le push, rien n'est
// réservé. « Envoyer » est à utiliser APRÈS « Figer la semaine » (sinon
// l'action refuse, clairement).

export function SendWeeklyRecapButton() {
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(test: boolean) {
    if (
      !test &&
      !window.confirm("Envoyer maintenant le récap de la dernière semaine à tous les joueurs ? Un push ne se reprend pas.")
    ) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await sendWeeklyRecap({ test });
      setFeedback(
        result.success ? { ok: true, text: result.message } : { ok: false, text: result.error },
      );
    });
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.button} onClick={() => run(true)} disabled={isPending}>
        {isPending ? "Envoi en cours…" : "M'envoyer un essai"}
      </button>
      <button type="button" className={styles.button} onClick={() => run(false)} disabled={isPending}>
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
