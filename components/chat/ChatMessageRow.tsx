"use client";

import { useActionState, useEffect } from "react";
import { deleteChatMessageFormAction } from "@/lib/actions/chat";
import { ReportMessageButton } from "./ReportMessageButton";
import type { ChatMessage } from "@/lib/queries/chat";
import styles from "./ChatMessageRow.module.css";

// Une ligne de message (SPEC_CHAT_V0_1.md §5) : bouton "Supprimer" visible
// UNIQUEMENT si `canDelete` (is_admin() du joueur courant, résolu côté
// serveur) -- chat_messages_delete_admin (RLS) reste la seule autorité
// réelle, ce bouton n'est qu'un raccourci UI pour l'admin. Retrait purement
// local via `onDeleted` (pas de diffusion Realtime, cf. ChatSubscriber).
//
// Bouton "Signaler" (03/09/2026, migration 20260903130000, cadrage
// juridique §2.10 point 7) : visible sur tout message qui n'est PAS le
// sien (`!isOwn`, déjà calculé pour le style de bulle) -- se signaler
// soi-même n'a pas de sens. Contrairement à "Supprimer", visible de tous
// les joueurs, pas seulement des admins (c'est bien le point du dispositif :
// laisser un joueur alerter un admin, pas seulement un admin agir).

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
        {(canDelete || !isOwn) && (
          <div className={styles.actions}>
            {canDelete && (
              <form action={formAction} className={styles.deleteForm}>
                <input type="hidden" name="messageId" value={message.id} />
                <button type="submit" disabled={pending} className={styles.deleteButton} aria-label="Supprimer ce message">
                  Supprimer
                </button>
              </form>
            )}
            {!isOwn && <ReportMessageButton messageId={message.id} />}
          </div>
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
