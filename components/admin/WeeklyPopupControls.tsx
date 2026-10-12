"use client";

import { useState, useTransition } from "react";
import {
  generateWeeklyPopupNow,
  generateWeeklyPopupTrial,
  skipWeeklyPopup,
  type PopupActionResult,
  type PopupTrial,
} from "@/lib/actions/admin-weekly-popup";
import { WeeklyPopupCard } from "@/components/weeklyPopup/WeeklyPopupCard";
import styles from "./WeeklyPopupEditor.module.css";

// Gestes d'une semaine sans brouillon, et essai (décision 13). Tous les appels
// LLM passent par une confirmation « appel payant ».

type Feedback = { ok: boolean; text: string } | null;

function useRunner() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();
  const run = (task: () => Promise<PopupActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await task();
      setFeedback(result.success ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });
  };
  return { feedback, isPending, run, startTransition, setFeedback };
}

/** Semaine figée sans ligne : générer, ou écarter pour pouvoir envoyer le push. */
export function WeeklyPopupMissingControls({ weekEnd, popupEnabled }: { weekEnd: string; popupEnabled: boolean }) {
  const { feedback, isPending, run } = useRunner();
  return (
    <div className={styles.editor}>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={isPending || !popupEnabled}
          title={popupEnabled ? undefined : "Active d'abord la popup hebdo sur la compétition."}
          onClick={() =>
            run(
              () => generateWeeklyPopupNow(),
              "Générer le brouillon maintenant ? C'est un appel payant (quelques centimes).",
            )
          }
        >
          {isPending ? "En cours…" : "Générer le brouillon"}
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={isPending}
          onClick={() =>
            run(
              () => skipWeeklyPopup({ weekEnd }),
              "Ne pas publier de popup cette semaine ? Le récap pourra être envoyé sans elle.",
            )
          }
        >
          Ne pas publier
        </button>
      </div>
      {feedback && (
        <p className={feedback.ok ? styles.success : styles.error} role={feedback.ok ? "status" : "alert"}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}

/** Essai : pipeline complet sur la dernière semaine close, rien d'écrit. */
export function WeeklyPopupTrial({ weekEnd }: { weekEnd: string }) {
  const [trial, setTrial] = useState<PopupTrial | null>(null);
  const [message, setMessage] = useState<Feedback>(null);
  const [isPending, startTransition] = useTransition();

  function launch() {
    const label = `${weekEnd.slice(8, 10)}/${weekEnd.slice(5, 7)}`;
    if (
      !window.confirm(
        `Lancer un essai sur la semaine close le ${label} ? Appel payant (jusqu'à 3 appels), rien n'est enregistré ni publié.`,
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await generateWeeklyPopupTrial();
      if (result.success) {
        setTrial(result.trial);
        setMessage({ ok: true, text: result.message });
      } else {
        setTrial(null);
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  return (
    <div className={styles.editor}>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} disabled={isPending} onClick={launch}>
          {isPending ? "Essai en cours…" : "Générer un essai (payant)"}
        </button>
      </div>
      {message && (
        <p className={message.ok ? styles.success : styles.error} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}
      {trial && (
        <div className={styles.editor}>
          <p className={styles.hint}>
            Semaine close le {trial.weekEnd.slice(8, 10)}/{trial.weekEnd.slice(5, 7)} ·{" "}
            {trial.status === "DOUBTFUL" ? "brouillon douteux" : trial.kind === "FALLBACK" ? "texte de repli" : "brouillon"}{" "}
            · {trial.candidateCount} candidat(s), {trial.blockedCount} bloqué(s) · {trial.costUsd.toFixed(3)} $
          </p>
          {trial.doubtDetail && <p className={styles.error}>Motif : {trial.doubtDetail}</p>}
          {trial.warnings.length > 0 && (
            <ul>
              {trial.warnings.map((w, index) => (
                <li key={`${w.code}-${index}`} className={styles.hint}>
                  {w.code}
                  {w.bloc ? ` (${w.bloc})` : ""}
                  {w.detail ? ` : ${w.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
          {trial.popup && (
            <div>
              <p className={styles.fieldLabel}>{trial.popup.titre}</p>
              <WeeklyPopupCard popup={trial.popup} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
