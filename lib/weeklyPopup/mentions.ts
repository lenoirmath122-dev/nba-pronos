// Balayage des mentions d'un texte produit par le LLM (plan §3.8). Pur.
// Réutilise le matcher de `tokens.ts` (appariement exact puis NFKD de longueur
// variable) : un second matcher divergerait sur les cas limites et laisserait
// passer une mention que `tokenize` ne reconnaît pas (revue PR 2).

import { ANY_TOKEN_RE, findMentions, normalizePseudo, type MentionHit, type MentionableUser } from "./tokens";

export { normalizePseudo };

export interface MentionScan {
  /** Occurrences de `@` du texte nettoyé de ses jetons entrants. */
  hits: MentionHit[];
  /** `@` suivi d'un caractère de pseudo mais hors ensemble fermé. */
  unknownCount: number;
  /** Jetons `{{u:...}}` présents dans le texte entrant (jamais produits par nous). */
  incomingTokens: number;
}

const PSEUDO_START_RE = /[\p{L}\p{N}_]/u;

export function scanMentions(text: string, closedSet: readonly MentionableUser[]): MentionScan {
  const incomingTokens = text.match(ANY_TOKEN_RE)?.length ?? 0;
  const clean = text.replace(ANY_TOKEN_RE, "");
  const hits = findMentions(clean, closedSet);
  // « @ » isolé ou « 20 @ 30 » n'est pas une mention inconnue.
  const unknownCount = hits.filter(
    (h) => h.userId === null && PSEUDO_START_RE.test(clean[h.start + 1] ?? ""),
  ).length;
  return { hits, unknownCount, incomingTokens };
}
