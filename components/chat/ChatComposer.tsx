"use client";

import { useActionState, useRef } from "react";
import { postChatMessageFormAction } from "@/lib/actions/chat";
import type { ChatScope } from "@/lib/queries/chat";
import styles from "./ChatComposer.module.css";

// Formulaire d'envoi (SPEC_CHAT_V0_1.md §5) : useActionState plutôt que le
// patron "formulaire natif + redirect" du reste de lib/actions/* -- une
// redirection à chaque message casserait le scroll/viderait le focus sur un
// écran pensé pour poster en rafale, même exception déjà faite pour
// LoginForm/SignupForm. React réinitialise seul les champs non contrôlés
// après une action réussie (comportement natif des form actions React 19),
// donc pas de reset manuel nécessaire ici.

type ChatComposerProps = { scope: ChatScope };

export function ChatComposer({ scope }: ChatComposerProps) {
  const [state, formAction, pending] = useActionState(postChatMessageFormAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={formAction} className={styles.form}>
      <input type="hidden" name="scopeType" value={scope.type} />
      {scope.type === "LEAGUE" && <input type="hidden" name="leagueId" value={scope.leagueId} />}
      <textarea
        name="body"
        placeholder="Écrire un message…"
        rows={1}
        maxLength={2000}
        required
        onKeyDown={handleKeyDown}
        className={styles.textarea}
      />
      <button type="submit" disabled={pending} className={styles.submit}>
        Envoyer
      </button>
      {state?.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
    </form>
  );
}
