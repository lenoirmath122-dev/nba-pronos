"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { markChatChannelSeen } from "@/lib/nav/chatSeen";
import { setChatReaction } from "@/lib/actions/chat";
import type { ChatMessage, ChatReaction, ChatRosterEntry, ChatScope } from "@/lib/queries/chat";
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

/** Remplace (ou retire si `emoji` est null) la réaction d'un joueur. */
function withReaction(reactions: ChatReaction[], userId: string, emoji: string | null): ChatReaction[] {
  const others = reactions.filter((r) => r.userId !== userId);
  return emoji === null ? others : [...others, { userId, emoji }];
}

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
            reactions: [],
          },
        ];
      });
    }

    // Réactions : une par (message, joueur). Idempotent, donc l'écho Realtime
    // d'une réaction déjà posée en optimiste ne change rien. Les réactions
    // d'un autre canal (pas de filtre possible côté table) ne trouvent aucun
    // message à modifier et sont ignorées.
    function applyReaction(payload: { new: { message_id: string; user_id: string; emoji: string } }) {
      const { message_id, user_id, emoji } = payload.new;
      setMessages((prev) =>
        prev.map((m) => (m.id === message_id ? { ...m, reactions: withReaction(m.reactions, user_id, emoji) } : m))
      );
    }
    function removeReaction(payload: { old: { message_id?: string; user_id?: string } }) {
      const { message_id, user_id } = payload.old;
      if (!message_id || !user_id) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === message_id ? { ...m, reactions: withReaction(m.reactions, user_id, null) } : m))
      );
    }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter }, applyInsert)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_message_reactions" }, applyReaction)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_message_reactions" }, applyReaction)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_message_reactions" }, removeReaction)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // scopeKey résume déjà (type, leagueId) -- pas besoin des 2 séparément ;
    // roster lu via rosterRef, volontairement absent des deps (cf. commentaire
    // au-dessus).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Conversation ouverte = lue jusqu'au dernier message affiché, y compris
  // ceux reçus en direct pendant qu'elle reste à l'écran (pastilles p3-7).
  const latestAt = messages.at(-1)?.createdAt;
  useEffect(() => {
    if (latestAt) markChatChannelSeen(scope.type === "LEAGUE" ? scope.leagueId : "general", latestAt);
  }, [scope, latestAt]);

  // Ouverture au dernier message (page-scroll, cf. ChatSubscriber.module.css) :
  // saut instantané en bas au montage, puis défilement doux à chaque nouveau
  // message si le lecteur était déjà proche du bas (ou en est l'auteur), pour
  // ne pas l'arracher à un historique qu'il est en train de relire.
  const messageCount = messages.length;
  const lastUserId = messages.at(-1)?.userId;
  const prevCountRef = useRef<number | null>(null);
  useEffect(() => {
    const el = document.documentElement;
    const prev = prevCountRef.current;
    prevCountRef.current = messageCount;
    if (prev === null) {
      window.scrollTo({ top: el.scrollHeight });
      return;
    }
    if (messageCount <= prev) return;
    const nearBottom = el.scrollHeight - window.scrollY - window.innerHeight < 300;
    if (nearBottom || lastUserId === currentUserId) {
      window.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messageCount, lastUserId, currentUserId]);

  function handleDeleted(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }

  // Mise à jour optimiste ; si l'action échoue on rétablit l'état précédent
  // de la réaction du joueur.
  function handleReact(messageId: string, emoji: string | null) {
    const previous =
      messages.find((m) => m.id === messageId)?.reactions.find((r) => r.userId === currentUserId)?.emoji ?? null;
    const apply = (value: string | null) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: withReaction(m.reactions, currentUserId, value) } : m))
      );
    apply(emoji);
    void setChatReaction(messageId, emoji).then((result) => {
      if (!result.success) apply(previous);
    });
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
              onReact={handleReact}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
      <ChatComposer scope={scope} />
    </div>
  );
}
