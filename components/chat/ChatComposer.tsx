"use client";

import { useActionState, useRef, useState } from "react";
import { postChatMessageFormAction } from "@/lib/actions/chat";
import type { ChatRosterEntry, ChatScope } from "@/lib/queries/chat";
import { activeMentionQuery } from "@/lib/chat/mentions";
import styles from "./ChatComposer.module.css";

// Formulaire d'envoi (SPEC_CHAT_V0_1.md §5) : useActionState plutôt que le
// patron "formulaire natif + redirect" du reste de lib/actions/* -- une
// redirection à chaque message casserait le scroll/viderait le focus sur un
// écran pensé pour poster en rafale, même exception déjà faite pour
// LoginForm/SignupForm. React réinitialise seul les champs non contrôlés
// après une action réussie (comportement natif des form actions React 19),
// donc pas de reset manuel nécessaire ici.

type ChatComposerProps = { scope: ChatScope; roster: ChatRosterEntry[]; currentUserId: string };

const MAX_SUGGESTIONS = 5;

export function ChatComposer({ scope, roster, currentUserId }: ChatComposerProps) {
  const [state, formAction, pending] = useActionState(postChatMessageFormAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Mention en cours de saisie (`@abc` avant le curseur) et choix surligné.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const suggestions = mention
    ? roster
        .filter((u) => u.id !== currentUserId && u.pseudo.toLowerCase().includes(mention.query.toLowerCase()))
        .sort((a, b) => {
          const aStarts = a.pseudo.toLowerCase().startsWith(mention.query.toLowerCase()) ? 0 : 1;
          const bStarts = b.pseudo.toLowerCase().startsWith(mention.query.toLowerCase()) ? 0 : 1;
          return aStarts - bStarts || a.pseudo.localeCompare(b.pseudo, "fr");
        })
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function refreshMention() {
    const el = textareaRef.current;
    if (!el) return;
    setMention(activeMentionQuery(el.value, el.selectionStart));
    setHighlighted(0);
  }

  function pickMention(pseudo: string) {
    const el = textareaRef.current;
    if (!el || !mention) return;
    el.setRangeText(`@${pseudo} `, mention.start, el.selectionStart, "end");
    setMention(null);
    el.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention && suggestions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setHighlighted((h) => (h + step + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickMention(suggestions[highlighted].pseudo);
        return;
      }
    }
    if (mention && event.key === "Escape") {
      setMention(null);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={formAction} className={styles.form}>
      <input type="hidden" name="scopeType" value={scope.type} />
      {scope.type === "LEAGUE" && <input type="hidden" name="leagueId" value={scope.leagueId} />}
      {suggestions.length > 0 && (
        <ul className={styles.suggestions} role="listbox" aria-label="Identifier un joueur">
          {suggestions.map((u, index) => (
            <li key={u.id} role="option" aria-selected={index === highlighted}>
              <button
                type="button"
                className={index === highlighted ? styles.suggestionActive : styles.suggestion}
                // pointerdown + preventDefault : garde le focus (et le curseur) dans le textarea.
                onPointerDown={(e) => {
                  e.preventDefault();
                  pickMention(u.pseudo);
                }}
              >
                @{u.pseudo}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={textareaRef}
        onInput={refreshMention}
        onClick={refreshMention}
        onBlur={() => setMention(null)}
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
