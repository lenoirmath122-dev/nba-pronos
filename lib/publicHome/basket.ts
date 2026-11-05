// Panier de pronos du visiteur (plan d'attractivité, §1.6 a) : logique pure,
// sans accès au navigateur. Le stockage (localStorage) vit dans le composant.

export const BASKET_KEY = "pb.publicBasket.v1";
export const MARGIN_MIN = 1;
export const MARGIN_MAX = 50;

export type BasketItem = {
  matchId: string;
  competitionId: string;
  winnerTeamId: string;
  margin: number;
  addedAt: number;
  /** Affichage du récap sur /enregistrer ; absents des paniers enregistrés avant le 27/10/2026. */
  winnerName?: string;
  opponentName?: string;
  scheduledAt?: string;
};

/** Ce que l'accueil sait d'un match encore ouvert : de quoi valider un item. */
export type OpenMatch = { id: string; scheduledAt: string; homeTeamId: string; awayTeamId: string };

export type PruneResult = { kept: BasketItem[]; removed: BasketItem[] };

export function isValidMargin(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= MARGIN_MIN && n <= MARGIN_MAX;
}

function isItem(x: unknown): x is BasketItem {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.matchId === "string" &&
    typeof o.competitionId === "string" &&
    typeof o.winnerTeamId === "string" &&
    isValidMargin(o.margin) &&
    typeof o.addedAt === "number"
  );
}

const DISPLAY_MAX = 60;

function displayText(x: unknown): string | undefined {
  return typeof x === "string" && x.length > 0 && x.length <= DISPLAY_MAX ? x : undefined;
}

/** Garde les champs d'affichage valides, jamais d'invalide : un ancien panier reste lisible tel quel. */
function normalizeItem(i: BasketItem): BasketItem {
  const { winnerName, opponentName, scheduledAt, ...core } = i;
  const at = displayText(scheduledAt);
  return {
    ...core,
    ...(displayText(winnerName) && { winnerName: displayText(winnerName) }),
    ...(displayText(opponentName) && { opponentName: displayText(opponentName) }),
    ...(at && Number.isFinite(Date.parse(at)) && { scheduledAt: at }),
  };
}

/** Tolérant : un stockage corrompu ou vide donne un panier vide, jamais d'erreur. */
export function parseBasket(raw: string | null): BasketItem[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    return data
      .filter(isItem)
      .filter((i) => !seen.has(i.matchId) && seen.add(i.matchId))
      .map(normalizeItem);
  } catch {
    return [];
  }
}

/** Retire les pronos dont le match est commencé, absent de la liste ouverte ou dont l'équipe ne correspond plus. */
export function pruneBasket(items: BasketItem[], open: OpenMatch[], nowMs: number): PruneResult {
  const byId = new Map(open.map((m) => [m.id, m]));
  const kept: BasketItem[] = [];
  const removed: BasketItem[] = [];
  for (const i of items) {
    const m = byId.get(i.matchId);
    const ok =
      m !== undefined &&
      Date.parse(m.scheduledAt) > nowMs &&
      (i.winnerTeamId === m.homeTeamId || i.winnerTeamId === m.awayTeamId);
    (ok ? kept : removed).push(i);
  }
  return { kept, removed };
}

/** Ajoute ou remplace le prono d'un match (un seul par match). */
export function upsertItem(items: BasketItem[], item: BasketItem): BasketItem[] {
  return [...items.filter((i) => i.matchId !== item.matchId), item];
}

export function removeItem(items: BasketItem[], matchId: string): BasketItem[] {
  return items.filter((i) => i.matchId !== matchId);
}
