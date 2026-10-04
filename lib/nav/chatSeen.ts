"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ChatActivity } from "@/lib/queries/chat";

// Messages non lus du chat (p3-7, retour de l'alpha) : comme la pastille
// « nouveaux résultats » (feedSeen.ts), l'état « lu » reste purement client,
// par appareil — le serveur fournit seulement la date des messages récents
// des autres joueurs (getRecentChatActivity), comparée ici au dernier message
// vu de chaque canal. Contrairement à feedSeen, un vrai abonnement est
// nécessaire : ouvrir un canal doit éteindre la pastille de la TabBar, déjà
// affichée, sans rechargement.

const STORAGE_KEY = "chat-seen-at";
const CHANGE_EVENT = "chat-seen-change";

/** Clé de canal partagée par la liste des canaux, la TabBar et ChatSubscriber :
 *  "general" ou l'id de la ligue (même valeur que le paramètre `?canal=`). */
export type ChatChannelKey = string;

export type SeenMap = Record<ChatChannelKey, string>;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): SeenMap {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? (value as SeenMap) : {};
  } catch {
    return {};
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Autre onglet du même navigateur.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Marque le canal comme lu jusqu'au message daté `at` (jamais en arrière). */
export function markChatChannelSeen(channel: ChatChannelKey, at: string) {
  const seen = parse(readRaw());
  const previous = seen[channel];
  if (previous && Date.parse(previous) >= Date.parse(at)) return;
  seen[channel] = at;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Nombre de messages non lus par canal, `null` tant que le client n'a pas lu
 *  son repère (rendu serveur, hydratation) — rien à afficher dans ce cas. */
export function useUnreadChatCounts(activity: ChatActivity[]): Map<ChatChannelKey, number> | null {
  // La chaîne brute sert d'instantané : stable entre deux lectures tant que
  // rien n'a changé, ce qu'exige useSyncExternalStore.
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined);

  return useMemo(() => {
    if (raw === undefined) return null;
    return countUnreadByChannel(activity, parse(raw));
  }, [raw, activity]);
}

/** Messages postérieurs au dernier vu de leur canal ; un canal jamais ouvert
 *  sur cet appareil compte tout ce que le serveur a renvoyé (fenêtre de 14 j). */
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
