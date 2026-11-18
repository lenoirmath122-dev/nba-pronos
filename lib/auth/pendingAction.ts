// Action en attente d'un invité (mode invité, lot B) : ce que le visiteur voulait
// faire quand on lui a demandé de créer un compte. Sérialisée en localStorage,
// relue après la connexion (/bienvenue) pour le ramener au bon endroit.
// Limite : un lien ouvert dans un autre navigateur n'a pas ce stockage ; le
// visiteur arrive alors sur /bienvenue sans reprise (le brouillon reste dans
// le premier navigateur).

export const PENDING_ACTION_KEY = "pb.pendingAction.v1";
export const CHAT_DRAFT_KEY = "pb.chatDraft.v1";
export const PENDING_ACTION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const PENDING_ACTION_TYPES = ["chat", "predict", "bet", "follow", "react"] as const;
export type PendingActionType = (typeof PENDING_ACTION_TYPES)[number];

export type PendingAction = {
  type: PendingActionType;
  /** Chemin interne où ramener le visiteur après connexion. */
  returnUrl: string;
  /** Données légères de l'action (id de match, id de message…), jamais de secret. */
  payload?: Record<string, string | number | boolean>;
  createdAt: number;
};

/** Chemin interne uniquement : refuse les URL absolues et les `//host`. */
export function isSafeReturnUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") && url.length <= 500;
}

export function serializePendingAction(action: PendingAction): string {
  return JSON.stringify(action);
}

export function parsePendingAction(raw: string | null, nowMs: number): PendingAction | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const { type, returnUrl, payload, createdAt } = data as Record<string, unknown>;
  if (!PENDING_ACTION_TYPES.includes(type as PendingActionType)) return null;
  if (!isSafeReturnUrl(returnUrl)) return null;
  if (typeof createdAt !== "number" || nowMs - createdAt > PENDING_ACTION_MAX_AGE_MS || createdAt > nowMs + 60_000) return null;
  const clean: Record<string, string | number | boolean> = {};
  if (typeof payload === "object" && payload !== null) {
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") clean[k] = v;
    }
  }
  return { type: type as PendingActionType, returnUrl, payload: clean, createdAt };
}

/** Où envoyer le visiteur validé : l'URL de retour, avec un repère de reprise. */
export function resumeUrl(action: PendingAction): string {
  const url = new URL(action.returnUrl, "http://local");
  url.searchParams.set("reprise", action.type);
  return `${url.pathname}${url.search}${url.hash}`;
}

export const CHAT_DRAFT_MAX = 2000;

export function parseChatDraft(raw: string | null): string {
  return typeof raw === "string" ? raw.slice(0, CHAT_DRAFT_MAX) : "";
}
