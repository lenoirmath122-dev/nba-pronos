import { parisDateKey, parisDayBoundsUtc } from "@/lib/dates/paris";
import type { NbaCupPopupAudience } from "./eligibility";

// Masquage de la popup NBA Cup, côté client uniquement (aucune migration,
// même principe que les autres pastilles « vu ») :
// - « Me rappeler plus tard » : localStorage, jusqu'à demain minuit (Paris) ;
// - croix, fond, Échap : sessionStorage, pour cette visite seulement.
// Clés distinctes visiteur / connecté : un visiteur qui a dit « plus tard »
// puis crée son compte revoit la popup une fois connecté (bracket vide).

/** Coupe-circuit e2e (e2e/fixtures.ts), comme les autres popups. */
export const NBA_CUP_POPUP_DISABLED_KEY = "nba-cup-popup:disabled";

export function snoozeStorageKey(audience: NbaCupPopupAudience): string {
  return `nba-cup-popup:${audience}:snoozed-until`;
}

export function closedStorageKey(audience: NbaCupPopupAudience): string {
  return `nba-cup-popup:${audience}:closed`;
}

/** Instant (ms) de demain 00:00, heure de Paris, vu depuis `nowMs`. */
export function nextParisMidnightMs(nowMs: number): number {
  return Date.parse(parisDayBoundsUtc(parisDateKey(nowMs)).endIsoExclusive);
}

export function isNbaCupPopupHidden(input: {
  disabled: boolean;
  snoozedUntil: string | null;
  closedThisSession: boolean;
  nowMs: number;
}): boolean {
  if (input.disabled || input.closedThisSession) return true;
  const until = Number(input.snoozedUntil);
  return input.snoozedUntil !== null && Number.isFinite(until) && until > input.nowMs;
}

/** « 6 j 4 h », « 5 h 12 min », « 12 min » — temps restant avant la date limite. */
export function formatTimeLeft(remainingMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}
