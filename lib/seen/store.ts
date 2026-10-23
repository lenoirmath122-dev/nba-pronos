"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";

// Repères « vu / fermé » liés au COMPTE (table user_seen_state), identiques sur
// tous les navigateurs et appareils. Deux usages :
//   - lecture synchrone (pastille Accueil, cartes) : le serveur amorce le store
//     (getUserSeenState), Realtime et les écritures locales le tiennent à jour ;
//   - lecture asynchrone (popups) : fetchSeenState lit la base, donc la valeur
//     la plus fraîche.
// localStorage ne sert plus qu'à reprendre, une fois, le repère qu'un appareil
// avait déjà (pont de migration), puis il est vidé.

export type SeenState = Record<string, string>;

export const FEED_SEEN_KEY = "feed-seen-at";
export const VALIDATED_BETS_SEEN_KEY = "validated-bets-seen-at";
export const ACTIVITY_RECAP_SEEN_KEY = "activity-recap-seen-at";
export const BADGES_SEEN_KEY = "badges-seen";
export const CARD_SEEN_PREFIX = "home-card-seen:";

// Anciennes clés localStorage reprises une fois (cartes : même nom que la clé base).
const LEGACY_LOCAL_KEYS: Record<string, string> = {
  [FEED_SEEN_KEY]: "home-feed-seen-at",
};

// `null` tant que le serveur n'a rien fourni (rendu serveur, hydratation).
let snapshot: SeenState | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function emit(next: SeenState) {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Valeur courante d'un repère : `undefined` = pas encore chargé, `null` = jamais posé. */
export function useSeenValue(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (snapshot === null ? undefined : (snapshot[key] ?? null)),
    () => undefined
  );
}

function removeLocal(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Stockage indisponible : sans gravité.
  }
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRemote(key: string, value: string): Promise<unknown> {
  return Promise.resolve(getBrowserClient().rpc("set_user_seen_state", { p_key: key, p_value: value })).catch(
    () => undefined
  );
}

/** Pose un repère : visible tout de suite, enregistré en base ensuite. */
export function setSeenValue(key: string, value: string) {
  if (snapshot?.[key] === value) return;
  emit({ ...(snapshot ?? {}), [key]: value });
  void writeRemote(key, value);
}

/** Lit un repère en base (valeur fraîche). Si le compte n'en a pas encore et que
 *  cet appareil en gardait un en localStorage (`legacyKey`), il est repris une
 *  fois dans la base puis effacé. `null` = jamais posé. */
export async function fetchSeenState(key: string, legacyKey?: string): Promise<string | null> {
  const { data } = await getBrowserClient().from("user_seen_state").select("value").eq("key", key).maybeSingle();
  const stored = (data as { value: string } | null)?.value ?? null;
  if (stored !== null) {
    if (legacyKey) removeLocal(legacyKey);
    return stored;
  }
  const legacy = legacyKey ? readLocal(legacyKey) : null;
  if (legacy === null || !legacyKey) return null;
  await writeRemote(key, legacy);
  removeLocal(legacyKey);
  return legacy;
}

/** Écrit un repère en base (popups) et met le store à jour. */
export async function saveSeenState(key: string, value: string) {
  emit({ ...(snapshot ?? {}), [key]: value });
  await writeRemote(key, value);
}

/** Reprend dans la base les repères que cet appareil gardait en localStorage
 *  (pastille Accueil, cartes) quand le compte n'en a pas encore. */
function migrateLegacy(known: SeenState) {
  const additions: SeenState = {};
  for (const [key, localKey] of Object.entries(LEGACY_LOCAL_KEYS)) {
    const value = readLocal(localKey);
    if (value !== null && known[key] === undefined) additions[key] = value;
    if (value !== null) removeLocal(localKey);
  }
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const localKey = window.localStorage.key(i);
      if (!localKey?.startsWith(CARD_SEEN_PREFIX)) continue;
      if (known[localKey] === undefined) additions[localKey] = "1";
      removeLocal(localKey);
    }
  } catch {
    // Stockage indisponible : sans gravité.
  }
  for (const [key, value] of Object.entries(additions)) setSeenValue(key, value);
}

/** Amorce le store depuis le serveur et écoute les repères posés sur les autres
 *  appareils du compte. Monté une fois, dans la TabBar. Une valeur déjà connue
 *  localement (plus récente que l'amorce du layout) n'est pas écrasée. */
export function useSeenStateSync(userId: string, seed: SeenState) {
  useEffect(() => {
    if (!userId) return;
    const current = snapshot ?? {};
    const merged: SeenState = { ...seed, ...current };
    emit(merged);
    migrateLegacy(merged);
  }, [userId, seed]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getBrowserClient();
    const apply = (payload: { new: { key: string; value: string } }) =>
      emit({ ...(snapshot ?? {}), [payload.new.key]: payload.new.value });
    const channel = supabase
      .channel(`seen-state-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_seen_state", filter: `user_id=eq.${userId}` },
        apply
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_seen_state", filter: `user_id=eq.${userId}` },
        apply
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
