"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteChatMessageFormAction } from "@/lib/actions/chat";
import { ReportMessageDialog } from "./ReportMessageDialog";
import { CHAT_REACTION_EMOJIS } from "@/lib/chat/reactions";
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
//
// Les deux actions vivent dans un menu "⋯" en haut à droite de la bulle
// (lisibilité : plus de liens d'action sous chaque message). Le "⋯" n'est
// rendu que s'il y a au moins une action disponible.
//
// Réactions (migration 20261022100000) : bouton « ☺ » à côté du « ⋯ » qui
// ouvre un sélecteur de 6 emojis fixes ; pastilles (emoji + compteur) sous le
// texte, la sienne en surbrillance. Une réaction par joueur : retoucher la
// sienne la retire, en toucher une autre la remplace.

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

type ChatMessageRowProps = {
  message: ChatMessage;
  isOwn: boolean;
  canDelete: boolean;
  onDeleted: (messageId: string) => void;
  onReact: (messageId: string, emoji: string | null) => void;
  currentUserId: string;
};

export function ChatMessageRow({ message, isOwn, canDelete, onDeleted, onReact, currentUserId }: ChatMessageRowProps) {
  const [state, formAction, pending] = useActionState(deleteChatMessageFormAction, undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasActions = canDelete || !isOwn;

  useEffect(() => {
    if (!menuOpen && !pickerOpen) return;
    function close() {
      setMenuOpen(false);
      setPickerOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, pickerOpen]);

  const myReaction = message.reactions.find((r) => r.userId === currentUserId)?.emoji ?? null;
  const counts = CHAT_REACTION_EMOJIS.map((emoji) => ({
    emoji,
    count: message.reactions.filter((r) => r.emoji === emoji).length,
  })).filter((c) => c.count > 0);

  function react(emoji: string) {
    setPickerOpen(false);
    onReact(message.id, emoji === myReaction ? null : emoji);
  }

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
          <div className={styles.tools} ref={menuRef}>
            <div className={styles.menu}>
              <button
                type="button"
                className={styles.menuTrigger}
                onClick={() => {
                  setMenuOpen(false);
                  setPickerOpen((open) => !open);
                }}
                aria-label="Réagir à ce message"
                aria-haspopup="true"
                aria-expanded={pickerOpen}
              >
                ☺
              </button>
              {pickerOpen && (
                <div className={styles.picker} role="group" aria-label="Choisir une réaction">
                  {CHAT_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={emoji === myReaction ? styles.pickerEmojiActive : styles.pickerEmoji}
                      onClick={() => react(emoji)}
                      aria-pressed={emoji === myReaction}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {hasActions && (
              <div className={styles.menu}>
                <button
                  type="button"
                  className={styles.menuTrigger}
                  onClick={() => {
                    setPickerOpen(false);
                    setMenuOpen((open) => !open);
                  }}
                  aria-label="Actions sur ce message"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className={styles.menuList} role="menu">
                    {!isOwn && (
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.menuItem}
                        onClick={() => {
                          setMenuOpen(false);
                          setReportOpen(true);
                        }}
                      >
                        Signaler
                      </button>
                    )}
                    {canDelete && (
                      <form action={formAction} className={styles.deleteForm}>
                        <input type="hidden" name="messageId" value={message.id} />
                        <button
                          type="submit"
                          role="menuitem"
                          disabled={pending}
                          className={`${styles.menuItem} ${styles.menuItemDanger}`}
                        >
                          Supprimer
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <p className={styles.body}>{message.body}</p>
        {counts.length > 0 && (
          <div className={styles.reactions}>
            {counts.map(({ emoji, count }) => (
              <button
                key={emoji}
                type="button"
                className={emoji === myReaction ? styles.pillMine : styles.pill}
                onClick={() => react(emoji)}
                aria-pressed={emoji === myReaction}
                aria-label={`${emoji} ${count}`}
              >
                <span aria-hidden="true">{emoji}</span> {count}
              </button>
            ))}
          </div>
        )}
      </div>
      {!isOwn && (
        <ReportMessageDialog messageId={message.id} isOpen={reportOpen} onClose={() => setReportOpen(false)} />
      )}
      {state?.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
    </div>
  );
}
