// Jetons de mention de la popup hebdomadaire (lot 5, plan §1.9 option C).
// Tout contenu stocké cite un joueur par `{{u:<uuid>}}` ; le pseudo n'est
// résolu qu'à l'affichage : compte supprimé = « un ancien joueur », refus
// d'être cité = « un joueur discret », changement de pseudo gratuit. Pur,
// sans I/O ; consommé par la génération (PR 3) et l'affichage/l'export (PR 5).

export const DELETED_PLAYER_LABEL = "un ancien joueur";
export const DISCREET_PLAYER_LABEL = "un joueur discret";

/** Jeton écrit par `delete_account_data` quand le compte est supprimé. */
export const DELETED_TOKEN_ID = "supprime";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE =
  /\{\{u:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|supprime)\}\}/g;
/** Tout ce qui ressemble à un jeton dans un texte entrant (même mal formé). */
export const ANY_TOKEN_RE = /\{\{u:[^}]*\}\}/g;
/** Caractère qui prolonge un pseudo (signes combinants compris) : une mention
 *  ne peut pas y finir. */
const PSEUDO_CHAR_RE = /[\p{L}\p{N}\p{M}_-]/u;

/** Un joueur citable : l'ensemble fermé (candidats ok + champions retenus). */
export interface MentionableUser {
  userId: string;
  pseudo: string;
}

/** Ce que l'affichage sait d'un joueur ; absent de la table = supprimé. */
export interface TokenUserInfo {
  pseudo: string;
  popupMentionsOptOut: boolean;
}

/** NFKD, sans accents ni signes combinants, minuscules. */
export function normalizePseudo(pseudo: string): string {
  return pseudo.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export function makeToken(userId: string): string {
  return `{{u:${userId}}}`;
}

/** Une occurrence de `@` : appariée à un joueur de l'ensemble fermé, ou non. */
export interface MentionHit {
  /** Index du `@`. */
  start: number;
  /** Index après la mention (start + 1 si non appariée). */
  end: number;
  userId: string | null;
}

/**
 * Chaque `@` du texte, apparié ou non à l'ensemble fermé. À chaque `@` :
 * plus longue correspondance, d'abord à l'identique puis normalisée, suivie
 * d'une fin de texte ou d'un caractère hors `[p{L}p{N}_-]` (`@max` ≠
 * `@maxime`). Deux pseudos qui se confondent une fois normalisés : la
 * correspondance normalisée est désactivée pour eux. Précondition : le texte
 * ne contient plus de jeton entrant (`tokenize` les retire d'abord).
 */
export function findMentions(text: string, closedSet: readonly MentionableUser[]): MentionHit[] {
  const hits: MentionHit[] = [];
  const users = closedSet.filter((u) => UUID_RE.test(u.userId) && u.pseudo.length > 0);
  const byLength = [...users].sort((a, b) => b.pseudo.length - a.pseudo.length);
  const normalizedCount = new Map<string, number>();
  const normalizedOf = new Map<string, string>();
  for (const u of users) {
    const n = normalizePseudo(u.pseudo);
    normalizedOf.set(u.userId, n);
    normalizedCount.set(n, (normalizedCount.get(n) ?? 0) + 1);
  }

  const endsCleanly = (end: number) => end >= text.length || !PSEUDO_CHAR_RE.test(text[end]);

  // Plus longue fin `end` telle que la tranche normalisée égale le pseudo
  // normalisé : la normalisation (NFD/NFC, ligatures) change les longueurs.
  const longestNormalizedEnd = (start: number, n: string, pseudoLength: number): number | null => {
    const maxEnd = Math.min(text.length, start + pseudoLength * 2 + 4);
    for (let end = maxEnd; end > start; end -= 1) {
      if (normalizePseudo(text.slice(start, end)) === n && endsCleanly(end)) return end;
    }
    return null;
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] !== "@") {
      i += 1;
      continue;
    }
    const start = i + 1;
    let hit: { user: MentionableUser; end: number } | null = null;

    for (const u of byLength) {
      const end = start + u.pseudo.length;
      if (text.slice(start, end) === u.pseudo && endsCleanly(end)) {
        hit = { user: u, end };
        break;
      }
    }
    if (!hit) {
      let best: { user: MentionableUser; end: number } | null = null;
      for (const u of byLength) {
        const n = normalizedOf.get(u.userId) as string;
        if (normalizedCount.get(n) !== 1) continue;
        const end = longestNormalizedEnd(start, n, u.pseudo.length);
        if (end !== null && (best === null || end > best.end)) best = { user: u, end };
      }
      hit = best;
    }

    if (hit) {
      hits.push({ start: i, end: hit.end, userId: hit.user.userId });
      i = hit.end;
    } else {
      hits.push({ start: i, end: i + 1, userId: null });
      i += 1;
    }
  }
  return hits;
}

/**
 * Remplace chaque `@pseudo` de l'ensemble fermé par son jeton (voir
 * `findMentions` pour l'appariement). Un `@` sans correspondance est laissé
 * tel quel.
 */
export function tokenize(rawText: string, closedSet: readonly MentionableUser[]): string {
  // Un jeton déjà présent dans la sortie du LLM n'a pas été produit par nous
  // (id copié du prompt, injection par un pseudo ou un texte de pari) : il
  // serait résolu à l'affichage hors de l'ensemble fermé. On le retire.
  const text = rawText.replace(ANY_TOKEN_RE, "");
  if (!text.includes("@")) return text;

  let out = "";
  let cursor = 0;
  for (const hit of findMentions(text, closedSet)) {
    if (hit.userId === null) continue;
    out += text.slice(cursor, hit.start) + makeToken(hit.userId);
    cursor = hit.end;
  }
  return out + text.slice(cursor);
}

/**
 * Résout les jetons à l'affichage. `users` : les joueurs encore existants ;
 * un identifiant absent (ou le jeton `supprime`) = compte supprimé.
 */
export function detokenize(text: string, users: ReadonlyMap<string, TokenUserInfo>): string {
  return text.replace(TOKEN_RE, (_match, id: string) => {
    if (id === DELETED_TOKEN_ID) return DELETED_PLAYER_LABEL;
    const info = users.get(id.toLowerCase()) ?? users.get(id);
    if (!info) return DELETED_PLAYER_LABEL;
    if (info.popupMentionsOptOut) return DISCREET_PLAYER_LABEL;
    // Un pseudo est du texte libre : on neutralise `{{` pour qu'une seconde
    // passe (export, recopie) ne puisse pas y lire un jeton.
    return `@${info.pseudo.replace(/\{\{/g, "{​{")}`;
  });
}

/** Identifiants des joueurs cités par des jetons (sans `supprime`, sans doublon). */
export function extractTokenUserIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m[1] !== DELETED_TOKEN_ID) ids.add(m[1].toLowerCase());
  }
  return [...ids];
}
