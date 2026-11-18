"use client";

import { useState } from "react";
import { useRequireAuth } from "@/components/auth/AuthGateProvider";
import { CHAT_DRAFT_KEY } from "@/lib/auth/pendingAction";
import styles from "./ChatComposer.module.css";

// Zone de saisie de l'invité : il peut écrire son message, mais l'envoi ouvre
// la modale de compte. Le brouillon est gardé dans ce navigateur (localStorage)
// et remis dans le champ à son retour (ChatComposer, `?reprise=chat`).
export function GuestChatComposer() {
  const requireAuth = useRequireAuth();
  const [text, setText] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (text.trim()) window.localStorage.setItem(CHAT_DRAFT_KEY, text);
    } catch {
      // Stockage indisponible : la modale s'ouvre quand même, sans brouillon.
    }
    requireAuth({ type: "chat", returnUrl: "/chat?canal=general" });
  }

  return (
    <form onSubmit={submit} className={styles.form}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Écrire un message…"
        rows={1}
        maxLength={2000}
        className={styles.textarea}
      />
      <button type="submit" className={styles.submit}>
        Envoyer
      </button>
    </form>
  );
}
