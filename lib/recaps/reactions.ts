// Réactions rapides aux highlights d'une nuit (Actualité, 13/11/2026).
// Jeu fixe : la contrainte CHECK de la table recap_reactions
// (migration 20261113150000_recap_reactions.sql) doit rester alignée.
// Module pur, partagé par la requête, l'action serveur et l'écran.

export const RECAP_REACTION_KINDS = ["RESPECT", "CHAMBRER"] as const;
export type RecapReactionKind = (typeof RECAP_REACTION_KINDS)[number];

export const RECAP_REACTION_TARGETS = ["TOP_SCORERS", "BEST_BET"] as const;
export type RecapReactionTarget = (typeof RECAP_REACTION_TARGETS)[number];

export const RECAP_REACTION_LABELS: Record<RecapReactionKind, string> = {
  RESPECT: "Respect",
  CHAMBRER: "Chambrer",
};

export function isRecapReactionKind(value: unknown): value is RecapReactionKind {
  return typeof value === "string" && (RECAP_REACTION_KINDS as readonly string[]).includes(value);
}

export function isRecapReactionTarget(value: unknown): value is RecapReactionTarget {
  return typeof value === "string" && (RECAP_REACTION_TARGETS as readonly string[]).includes(value);
}

/** Compteurs d'un highlight et réaction du joueur courant (null = aucune). */
export type ReactionSummary = { counts: Record<RecapReactionKind, number>; mine: RecapReactionKind | null };

export type ReactionRow = { recap_date: string; target: string; user_id: string; kind: string };

export function reactionKey(recapDate: string, target: RecapReactionTarget): string {
  return `${recapDate}|${target}`;
}

export function emptyReactionSummary(): ReactionSummary {
  return { counts: { RESPECT: 0, CHAMBRER: 0 }, mine: null };
}

/** Regroupe les lignes par highlight (clé reactionKey). Les lignes hors jeu
 *  (cible ou réaction inconnue) sont ignorées. */
export function summarizeReactions(rows: ReactionRow[], currentUserId: string): Map<string, ReactionSummary> {
  const summaries = new Map<string, ReactionSummary>();
  for (const row of rows) {
    if (!isRecapReactionTarget(row.target) || !isRecapReactionKind(row.kind)) continue;
    const key = reactionKey(row.recap_date, row.target);
    const summary = summaries.get(key) ?? emptyReactionSummary();
    summary.counts[row.kind] += 1;
    if (row.user_id === currentUserId) summary.mine = row.kind;
    summaries.set(key, summary);
  }
  return summaries;
}

/** Nouvel état après un tap (mise à jour optimiste) : retoucher sa réaction
 *  la retire, toucher l'autre la remplace. */
export function applyReactionTap(summary: ReactionSummary, kind: RecapReactionKind): ReactionSummary {
  const counts = { ...summary.counts };
  if (summary.mine) counts[summary.mine] = Math.max(0, counts[summary.mine] - 1);
  if (summary.mine === kind) return { counts, mine: null };
  counts[kind] += 1;
  return { counts, mine: kind };
}
