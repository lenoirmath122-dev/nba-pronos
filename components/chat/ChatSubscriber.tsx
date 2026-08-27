"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { ChatMessage, ChatRosterEntry, ChatScope } from "@/lib/queries/chat";
import { ChatMessageRow } from "./ChatMessageRow";
import { ChatComposer } from "./ChatComposer";
import styles from "./ChatSubscriber.module.css";

// Provider + rendu de la liste (SPEC_CHAT_V0_1.md §4/§5) : même patron que
// LiveSubscriber (components/play/LiveSubscriber.tsx) -- un seul canal
// Realtime pour l'écran, état seedé par le SSR (`seed`), mis à jour par les
// événements entrants. Contrairement à LiveSubscriber (UPDATE sur des lignes
// déjà connues), ici on AJOUTE des lignes (INSERT) au fil de l'eau -- ordre
// et composition de la liste changent bien, c'est le but d'un chat.
//
// DELETE volontairement PAS écouté ici : un message supprimé par un admin
// est retiré localement (onDeleted, callback simple) mais ne se propage pas
// en direct aux autres joueurs connectés -- cf. commentaire de la migration
// 20260827100000_chat.sql pour le pourquoi (REPLICA IDENTITY par défaut).

type RawChatRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type ChatSubscriberProps = {
  seed: ChatMessage[];
  roster: ChatRosterEntry[];
  scope: ChatScope;
  currentUserId: string;
  isCurrentUserAdmin: boolean;
};

export function ChatSubscriber({ seed, roster, scope, currentUserId, isCurrentUserAdmin }: ChatSubscriberProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(seed);
  const scopeKey = scope.type === "LEAGUE" ? scope.leagueId : "GLOBAL";

  // Pas de resynchro `seed` -> état ici : le parent (app/(app)/chat/page.tsx)
  // pose `key={scopeKey}` sur ce composant, donc un changement de canal le
  // démonte/remonte entièrement -- `useState(seed)` repart déjà à neuf.

  // `roster` LU via une ref, PAS dans les deps de l'effet ci-dessous : posté
  // en conditions réelles, l'auteur d'un message perdait la réception de son
  // PROPRE message (Realtime) car chaque Server Action (poster/supprimer)
  // déclenche un refresh de la page côté Next.js -> nouvelle référence
  // `roster` (même contenu) -> effet re-déclenché -> canal fermé PUIS
  // rouvert juste au moment où l'événement Realtime du message qu'on vient
  // de poster arrivait, donc raté (pas de rejeu des événements manqués à la
  // resouscription). Confirmé par scripts/_check_chat.mjs (échec reproductible
  // uniquement pour l'AUTEUR du message, jamais pour un simple lecteur).
  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
  }, [roster]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const filter = scope.type === "GLOBAL" ? "scope_type=eq.GLOBAL" : `league_id=eq.${scope.leagueId}`;
    const channelName = `chat-${scopeKey}`;

    function applyInsert(payload: { new: RawChatRow }) {
      const row = payload.new;
      const rosterById = new Map(rosterRef.current.map((u) => [u.id, u]));
      const author = rosterById.get(row.user_id) ?? { id: row.user_id, pseudo: "Joueur", avatarUrl: null, isAdmin: false };
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev; // déjà présent (propre message déjà rendu localement ? -- garde-fou, cf. ChatComposer)
        return [
          ...prev,
          {
            id: row.id,
            userId: row.user_id,
            pseudo: author.pseudo,
            avatarUrl: author.avatarUrl,
            isAdmin: author.isAdmin,
            body: row.body,
            createdAt: row.created_at,
          },
        ];
      });
    }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter }, applyInsert)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // scopeKey résume déjà (type, leagueId) -- pas besoin des 2 séparément ;
    // roster lu via rosterRef, volontairement absent des deps (cf. commentaire
    // au-dessus).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  function handleDeleted(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.list} aria-live="polite">
        {messages.length === 0 ? (
          <p className={styles.empty}>Aucun message pour l&apos;instant. Lance la discussion !</p>
        ) : (
          messages.map((message) => (
            <ChatMessageRow
              key={message.id}
              message={message}
              isOwn={message.userId === currentUserId}
              canDelete={isCurrentUserAdmin}
              onDeleted={handleDeleted}
            />
          ))
        )}
      </div>
      <ChatComposer scope={scope} />
    </div>
  );
}
