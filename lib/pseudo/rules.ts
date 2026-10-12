// Règles du changement de pseudo (miroir de request_pseudo_change, migration
// 20261014090000) : la base reste l'autorité, ce module sert à répondre tôt
// côté serveur et à poser maxLength sur le champ.

export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
export const PSEUDO_COOLDOWN_DAYS = 30;

export function normalizePseudo(raw: string): string {
  return raw.trim();
}

export function pseudoLengthError(pseudo: string): string | null {
  const length = [...pseudo].length;
  if (length < PSEUDO_MIN_LENGTH || length > PSEUDO_MAX_LENGTH) {
    return `Le pseudo doit faire entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères.`;
  }
  return null;
}

/** Codes renvoyés par request_pseudo_change / approve_ / reject_pseudo_change. */
export const PSEUDO_RPC_MESSAGES: Record<string, string> = {
  INVALID_LENGTH: `Le pseudo doit faire entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères.`,
  SAME: "C'est déjà ton pseudo.",
  TAKEN: "Ce pseudo est déjà pris ou déjà demandé par un autre joueur.",
  PENDING_EXISTS: "Tu as déjà une demande en attente.",
  COOLDOWN: `Tu as déjà changé de pseudo il y a moins de ${PSEUDO_COOLDOWN_DAYS} jours.`,
  UNAUTHENTICATED: "Tu dois être connecté.",
  FORBIDDEN: "Action réservée aux admins.",
  NOT_FOUND: "Demande introuvable.",
  ALREADY_DONE: "Cette demande a déjà été traitée.",
  SELF: "Tu ne peux pas traiter ta propre demande.",
};
