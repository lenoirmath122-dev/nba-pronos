"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { ChatActivity } from "@/lib/queries/chat";

// Messages non lus du chat (p3-7, retour de l'alpha) : l'état « lu » est
// stocké en base par compte (table chat_read_status), donc identique sur tous
// les navigateurs et appareils. Le serveur fournit le repère de chaque canal
// (getChatReadStatus) et la date des messages récents des autres joueurs
// (getRecentChatActivity) ; le store ci-dessous ne fait que garder ce repère à
// jour en mémoire — mise à jour optimiste à l'ouverture d'un canal, événements
// Realtime pour les lectures faites ailleurs. Aucun localStorage.

/** Clé de canal partagée par la liste des canaux, la TabBar et ChatSubscriber :
 *  "general" ou l'id de la ligue (même valeur que le paramètre `?canal=`). */
export type ChatChannelKey = string;

export type SeenMap = Record<ChatChannelKey, string>;

// `null` tant que le serveur n'a pas fourni le repère (rendu serveur,
// hydratation) : rien à afficher dans ce cas. Remplacé à chaque changement
// (instantané stable pour useSyncExternalStore).
let seenSnapshot: SeenMap | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Fusionne des repères « lu » : pour chaque canal, la date la plus récente
 *  gagne (un repère ne recule jamais, donc un layout resté en cache ne peut
 *  pas rallumer une pastille). */
function mergeSeen(entries: SeenMap) {
  const next: SeenMap = { ...(seenSnapshot ?? {}) };
  let changed = seenSnapshot === null;
  for (const [channel, at] of Object.entries(entries)) {
    const previous = next[channel];
    if (previous && Date.parse(previous) >= Date.parse(at)) continue;
    next[channel] = at;
    changed = true;
  }
  if (!changed) return;
  seenSnapshot = next;
  for (const listener of listeners) listener();
}

/** Marque le canal comme lu jusqu'au message daté `at` (jamais en arrière) :
 *  pastille éteinte tout de suite, puis enregistré en base. */
export function markChatChannelSeen(channel: ChatChannelKey, at: string) {
  const previous = seenSnapshot?.[channel];
  if (previous && Date.parse(previous) >= Date.parse(at)) return;
  mergeSeen({ [channel]: at });
  void getBrowserClient().rpc("mark_chat_channel_read", { p_channel: channel });
}

type ChatReadRow = { channel: string; last_read_at: string };

/** Alimente le store depuis le serveur et écoute les lectures faites sur les
 *  autres appareils / onglets du compte. Monté une fois, dans la TabBar. */
export function useChatReadSync(userId: string, readStatus: SeenMap) {
  useEffect(() => {
    if (userId) mergeSeen(readStatus);
  }, [userId, readStatus]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getBrowserClient();
    const apply = (payload: { new: ChatReadRow }) =>
      mergeSeen({ [payload.new.channel]: payload.new.last_read_at });
    const channel = supabase
      .channel(`chat-read-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_read_status", filter: `user_id=eq.${userId}` },
        apply
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_read_status", filter: `user_id=eq.${userId}` },
        apply
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** Nombre de messages non lus par canal, `null` tant que le repère serveur
 *  n'est pas arrivé côté client — rien à afficher dans ce cas. */
export function useUnreadChatCounts(activity: ChatActivity[]): Map<ChatChannelKey, number> | null {
  const seen = useSyncExternalStore(
    subscribe,
    () => seenSnapshot,
    () => null
  );

  return useMemo(() => {
    if (seen === null) return null;
    return countUnreadByChannel(activity, seen);
  }, [seen, activity]);
}

/** Messages postérieurs au dernier vu de leur canal ; un canal sans repère
 *  compte tout ce que le serveur a renvoyé (fenêtre de 14 j). */
export function countUnreadByChannel(activity: ChatActivity[], seen: SeenMap): Map<ChatChannelKey, number> {
  const counts = new Map<ChatChannelKey, number>();
  for (const message of activity) {
    const seenAt = seen[message.channel];
    if (seenAt && Date.parse(message.createdAt) <= Date.parse(seenAt)) continue;
    counts.set(message.channel, (counts.get(message.channel) ?? 0) + 1);
  }
  return counts;
}

export function formatUnreadCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}
