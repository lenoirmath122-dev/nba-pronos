"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  bracketDraftKey,
  parseBracketDraft,
  serializeBracketDraft,
  type GuestPicks,
} from "@/lib/bracketFill/guestDraft";

// Brouillon du bracket invité (28/11/2026, CHANTIER_BRACKET_INVITE.md), lu
// dans le navigateur. useSyncExternalStore plutôt qu'un effet : pas d'état
// recopié (react-hooks/set-state-in-effect) et rendu serveur sans brouillon
// (snapshot serveur null), donc pas d'écart d'hydratation.

const CHANGE_EVENT = "pb:bracketDraft";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseNow(raw: string | null, competitionId: string): GuestPicks {
  return parseBracketDraft(raw, competitionId, Date.now());
}

export function useBracketDraft(competitionId: string) {
  const key = bracketDraftKey(competitionId);
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null
  );
  const picks = useMemo(() => parseNow(raw, competitionId), [raw, competitionId]);

  const write = useCallback(
    (next: GuestPicks) => {
      try {
        window.localStorage.setItem(key, serializeBracketDraft(competitionId, next, Date.now()));
      } catch {
        // Stockage indisponible (navigation privée stricte) : le choix est perdu au rechargement.
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key, competitionId]
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Idem.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key]);

  return { picks, write, clear };
}
