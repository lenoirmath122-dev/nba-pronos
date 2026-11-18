"use client";

import { useEffect, useState } from "react";
import { useRequireAuth } from "@/components/auth/AuthGateProvider";
import { CHAT_DRAFT_KEY, CHAT_DRAFT_MAX, parseChatDraft } from "@/lib/auth/pendingAction";
import styles from "./guest.module.css";

// Zone d'écriture du chat pour un invité : le texte est écrit en localStorage à
// chaque frappe (jamais perdu), l'envoi ouvre la modale de compte.
export function GuestChatComposer() {
  const requireAuth = useRequireAuth();
  const [text, setText] = useState("");

  useEffect(() => {
    const load = () => {
      try {
        setText(parseChatDraft(window.localStorage.getItem(CHAT_DRAFT_KEY)));
      } catch {
        // Brouillon indisponible : zone vide.
      }
    };
    load();
  }, []);

  function change(value: string) {
    setText(value);
    try {
      window.localStorage.setItem(CHAT_DRAFT_KEY, value);
    } catch {
      // Stockage plein ou bloqué : on garde le texte à l'écran.
    }
  }

  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        requireAuth({ type: "chat", returnUrl: "/chat" });
      }}
    >
      <label htmlFor="guest-chat-text" className={styles.when}>
        Écrire dans le Général
      </label>
      <textarea
        id="guest-chat-text"
        value={text}
        maxLength={CHAT_DRAFT_MAX}
        rows={2}
        onChange={(e) => change(e.target.value)}
        className={styles.composerInput}
      />
      <button type="submit" className={styles.cta}>
        Envoyer
      </button>
    </form>
  );
}
