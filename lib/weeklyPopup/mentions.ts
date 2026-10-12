// Balayage des mentions d'un texte produit par le LLM (plan §3.8). Pur.
// Réutilise le matcher de `tokens.ts` (appariement exact puis NFKD de longueur
// variable) : un second matcher divergerait sur les cas limites et laisserait
// passer une mention que `tokenize` ne reconnaît pas (revue PR 2).

import {
  ANY_TOKEN_RE,
  findMentions,
  normalizePseudo,
  stripIncomingTokens,
  type MentionHit,
  type MentionableUser,
} from "./tokens";

export { normalizePseudo };

export interface MentionScan {
  /** Occurrences de `@` du texte nettoyé de ses jetons entrants. */
  hits: MentionHit[];
  /** `@` collé à un caractère non blanc mais hors ensemble fermé. */
  unknownCount: number;
  /** Jetons `{{u:...}}` présents dans le texte entrant (jamais produits par nous). */
  incomingTokens: number;
}

const PSEUDO_CHAR_RE = /[\p{L}\p{N}\p{M}_-]/u;

/** Pseudos plus courts : trop de faux positifs pour un simple avertissement. */
const BARE_MIN_LENGTH = 3;

export function scanMentions(text: string, closedSet: readonly MentionableUser[]): MentionScan {
  const incomingTokens = text.match(ANY_TOKEN_RE)?.length ?? 0;
  const clean = stripIncomingTokens(text);
  const hits = findMentions(clean, closedSet);
  // « @ » isolé ou « 20 @ 30 » n'est pas une mention inconnue ; tout `@` collé
  // à un caractère non blanc l'est (les pseudos sont du texte libre, ils
  // peuvent commencer par un symbole).
  const unknownCount = hits.filter((h) => {
    if (h.userId !== null) return false;
    const next = clean[h.start + 1];
    return next !== undefined && !/\s/u.test(next) && next !== "@";
  }).length;
  return { hits, unknownCount, incomingTokens };
}

/**
 * Pseudos de l'ensemble fermé cités SANS « @ » (« Max a fait 40 points ») : ni
 * tokenisés ni retrouvables par la purge de compte. Forme normalisée, bornes de
 * mot, jamais précédés d'un « @ ». Renvoie un compte (jamais le pseudo).
 */
export function countBareMentions(text: string, closedSet: readonly MentionableUser[]): number {
  const clean = normalizePseudo(stripIncomingTokens(text));
  const seen = new Set<string>();
  let count = 0;
  for (const user of closedSet) {
    const needle = normalizePseudo(user.pseudo).trim();
    if (needle.length < BARE_MIN_LENGTH || seen.has(needle)) continue;
    seen.add(needle);
    for (let from = 0; from <= clean.length - needle.length; ) {
      const index = clean.indexOf(needle, from);
      if (index === -1) break;
      const before = index === 0 ? "" : clean[index - 1];
      const after = clean[index + needle.length] ?? "";
      const startsClean = before === "" || (before !== "@" && !PSEUDO_CHAR_RE.test(before));
      const endsClean = after === "" || !PSEUDO_CHAR_RE.test(after);
      if (startsClean && endsClean) {
        count += 1;
        break;
      }
      from = index + 1;
    }
  }
  return count;
}
