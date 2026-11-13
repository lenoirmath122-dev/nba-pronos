import type { FeedItem } from "@/lib/queries/home";
import type { RecapBet, RecapPlayer } from "@/lib/recaps/build";
import { addDays } from "@/lib/recaps/period";
import { pointsLabel } from "@/lib/recaps/text";

// Petites formules de la carte « Ta nuit » (Actualité, 13/11/2026). Module pur.

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });
const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function noon(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

/** « Nuit du 12 au 13 nov. », « Nuit du 31 oct. au 1 nov. ». */
export function nightLabel(recapDate: string): string {
  const eve = addDays(recapDate, -1);
  const sameMonth = eve.slice(0, 7) === recapDate.slice(0, 7);
  const from = sameMonth ? DAY.format(noon(eve)) : DAY_MONTH.format(noon(eve));
  return `Nuit du ${from} au ${DAY_MONTH.format(noon(recapDate))}`;
}

/** Bilan des paris tranchés de la nuit : un neutralisé ne compte ni comme
 *  réussi ni comme raté (R-COL2), il est retiré du total. */
export type NightTally = { won: number; settled: number };

export function nightTally(items: FeedItem[]): NightTally {
  let won = 0;
  let settled = 0;
  for (const item of items) {
    if (item.outcome === "neutral") continue;
    settled += 1;
    if (item.outcome === "win") won += 1;
  }
  return { won, settled };
}

export function tallyLabel({ won, settled }: NightTally): string {
  return `${won} réussi${won > 1 ? "s" : ""} sur ${settled}`;
}

/** Texte pré-rempli du chat (bouton « Répondre » d'un highlight) : mentionne
 *  le ou les joueurs concernés, avec le contexte. */
export function replyToTopScorers(players: RecapPlayer[]): string {
  const mentions = players.map((player) => `@${player.pseudo}`).join(" ");
  return `${mentions} meilleure nuit (+${pointsLabel(players[0]?.value ?? 0)}) `;
}

export function replyToBestBet(bet: RecapBet): string {
  return `@${bet.pseudo} « ${bet.description} » `;
}

/** Longueur maximale du texte pré-rempli accepté par /chat?citer=. */
export const CHAT_PREFILL_MAX_LENGTH = 300;

export function chatReplyHref(text: string): string {
  return `/chat?canal=general&citer=${encodeURIComponent(text.slice(0, CHAT_PREFILL_MAX_LENGTH))}`;
}
