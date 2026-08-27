"use client";

import { useActionState, useEffect } from "react";
import { deleteChatMessageFormAction } from "@/lib/actions/chat";
import type { ChatMessage } from "@/lib/queries/chat";
import styles from "./ChatMessageRow.module.css";

// Une ligne de message (SPEC_CHAT_V0_1.md §5) : bouton "Supprimer" visible
// UNIQUEMENT si `canDelete` (is_admin() du joueur courant, résolu côté
// serveur) -- chat_messages_delete_admin (RLS) reste la seule autorité
// réelle, ce bouton n'est qu'un raccourci UI pour l'admin. Retrait purement
// local via `onDeleted` (pas de diffusion Realtime, cf. ChatSubscriber).

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

type ChatMessageRowProps = {
  message: ChatMessage;
  isOwn: boolean;
  canDelete: boolean;
  onDeleted: (messageId: string) => void;
};

export function ChatMessageRow({ message, isOwn, canDelete, onDeleted }: ChatMessageRowProps) {
  const [state, formAction, pending] = useActionState(deleteChatMessageFormAction, undefined);

  useEffect(() => {
    if (state && !state.error) onDeleted(message.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className={isOwn ? styles.rowOwn : styles.row}>
      <div className={styles.bubble}>
        <div className={styles.meta}>
          <span className={styles.pseudo}>
            {message.pseudo}
            {message.isAdmin && <span className={styles.adminTag}>admin</span>}
          </span>
          <span className={styles.time}>{formatTime(message.createdAt)}</span>
        </div>
        <p className={styles.body}>{message.body}</p>
        {canDelete && (
          <form action={formAction} className={styles.deleteForm}>
            <input type="hidden" name="messageId" value={message.id} />
            <button type="submit" disabled={pending} className={styles.deleteButton} aria-label="Supprimer ce message">
              Supprimer
            </button>
          </form>
        )}
      </div>
      {state?.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
    </div>
  );
}
