"use client";

import { useState, useTransition } from "react";
import {
  publishWeeklyPopup,
  regenerateWeeklyPopup,
  retractWeeklyPopup,
  saveWeeklyPopupDraft,
  skipWeeklyPopup,
  type PopupActionResult,
} from "@/lib/actions/admin-weekly-popup";
import { WORD_LIMITS } from "@/lib/weeklyPopup/config";
import { EDITABLE_FIELDS, type EditableField, type EditorFields } from "@/lib/weeklyPopup/edit";
import { countWords, wordStatus } from "@/lib/weeklyPopup/words";
import styles from "./WeeklyPopupEditor.module.css";

// Éditeur et boutons de la popup hebdo (lot 5, PR 4). Tout texte est rendu en
// nœuds React ; aucune insertion de HTML. Les boutons « payants » demandent
// confirmation (chaque appel LLM coûte, plan §5.1).

const FIELD_LABEL: Record<EditableField, string> = {
  titre: "Titre",
  champion: "En tête (champion)",
  classement: "Le classement",
  top: "Le coup de la semaine",
  flop: "Raté de peu",
  refuse: "Refusé",
  cta: "Appel à l'action",
};

type Props = {
  popupId: string;
  fields: EditorFields;
  /** Texte de repli (kind FALLBACK) : fixe, non modifiable ici. */
  repli: string | null;
  canEdit: boolean;
  canPublish: boolean;
  canSkip: boolean;
  canRetract: boolean;
  canRegenerate: boolean;
  /** Publication bloquée par les contrôles (le bouton reste visible, il explique). */
  blockedByChecks: boolean;
};

export function WeeklyPopupEditor(props: Props) {
  const [fields, setFields] = useState<EditorFields>(props.fields);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = EDITABLE_FIELDS.some((f) => fields[f] !== props.fields[f]);

  function run(task: () => Promise<PopupActionResult>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await task();
      setFeedback(result.success ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });
  }

  const total = EDITABLE_FIELDS.reduce((sum, f) => sum + countWords(fields[f]), 0);

  return (
    <div className={styles.editor}>
      {props.repli !== null && (
        <p className={styles.repli}>
          Texte de repli (fixe) : <span>{props.repli}</span>
        </p>
      )}

      {EDITABLE_FIELDS.map((field) => {
        const words = countWords(fields[field]);
        const status = wordStatus(words, WORD_LIMITS[field]);
        return (
          <label key={field} className={styles.field}>
            <span className={styles.fieldHead}>
              <span className={styles.fieldLabel}>{FIELD_LABEL[field]}</span>
              <span
                className={status === "error" ? styles.countError : status === "warn" ? styles.countWarn : styles.count}
              >
                {words}/{WORD_LIMITS[field]} mots
              </span>
            </span>
            <textarea
              className={styles.textarea}
              rows={field === "titre" || field === "cta" ? 1 : 3}
              value={fields[field]}
              disabled={!props.canEdit || isPending}
              onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))}
            />
          </label>
        );
      })}
      <p className={styles.total}>Total : {total} mots (limite 180)</p>
      <p className={styles.hint}>
        Cite un joueur avec « @pseudo » exactement : sans « @ », la mention échappe au désengagement et à la purge de
        compte (publication refusée).
      </p>

      <div className={styles.actions}>
        {props.canEdit && (
          <button
            type="button"
            className={styles.primary}
            disabled={isPending || !dirty}
            onClick={() => run(() => saveWeeklyPopupDraft(props.popupId, fields))}
          >
            {isPending ? "En cours…" : "Enregistrer"}
          </button>
        )}
        {props.canPublish && (
          <button
            type="button"
            className={styles.primary}
            disabled={isPending || dirty || props.blockedByChecks}
            title={
              dirty
                ? "Enregistre d'abord tes modifications."
                : props.blockedByChecks
                  ? "Des erreurs bloquent la publication (voir ci-dessus)."
                  : undefined
            }
            onClick={() =>
              run(
                () => publishWeeklyPopup(props.popupId),
                "Publier cette popup ? Les joueurs la verront à leur prochaine ouverture de l'appli.",
              )
            }
          >
            Publier
          </button>
        )}
        {props.canRegenerate && (
          <button
            type="button"
            className={styles.secondary}
            disabled={isPending}
            onClick={() =>
              run(
                () => regenerateWeeklyPopup(props.popupId),
                "Régénérer ? C'est un appel payant, et il remplace le texte actuel (tes retouches comprises).",
              )
            }
          >
            Régénérer
          </button>
        )}
        {props.canSkip && (
          <button
            type="button"
            className={styles.secondary}
            disabled={isPending}
            onClick={() =>
              run(
                () => skipWeeklyPopup({ popupId: props.popupId }),
                "Ne pas publier de popup cette semaine ? Tu pourras encore régénérer ensuite.",
              )
            }
          >
            Ne pas publier
          </button>
        )}
        {props.canRetract && (
          <button
            type="button"
            className={styles.danger}
            disabled={isPending}
            onClick={() =>
              run(
                () => retractWeeklyPopup(props.popupId),
                "Retirer cette popup ? Les joueurs qui ne l'ont pas encore vue ne la verront plus.",
              )
            }
          >
            Retirer
          </button>
        )}
      </div>

      {feedback && (
        <p className={feedback.ok ? styles.success : styles.error} role={feedback.ok ? "status" : "alert"}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
