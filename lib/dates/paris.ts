// Bornes UTC d'un jour calendaire Europe/Paris, sans dépendance externe
// (aucune librairie de fuseaux installée dans ce projet). Extrait de
// lib/queries/my-predictions.ts (2e utilisateur : lib/queries/admin-logs.ts)
// pour éviter une 3e implémentation divergente — module NEUTRE (aucun
// next/headers), safe pour tout module serveur.

const DAY_TIMEZONE = "Europe/Paris";

/** L'offset est calculé à midi UTC de ce jour, ce qui évite l'ambiguïté
 *  d'une éventuelle bascule DST pile à minuit. */
export function parisDayBoundsUtc(dateStr: string): { startIso: string; endIsoExclusive: string } {
  const noonUtcMs = Date.parse(`${dateStr}T12:00:00.000Z`);
  const offsetMinutes = parisOffsetMinutesAt(noonUtcMs);
  const startMs = Date.parse(`${dateStr}T00:00:00.000Z`) - offsetMinutes * 60 * 1000;
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return { startIso: new Date(startMs).toISOString(), endIsoExclusive: new Date(endMs).toISOString() };
}

/** Convertit une heure MURALE Paris (ex. valeur brute d'un <input
 *  type="datetime-local">, "YYYY-MM-DDTHH:mm", SANS fuseau) en instant UTC
 *  réel. Décalage déduit dynamiquement (jamais +1/+2 codé en dur) — reste
 *  correct été comme hiver, y compris à la bascule DST. */
export function parisLocalToUtcIso(localValue: string): string {
  const naiveMs = Date.parse(`${localValue}:00.000Z`); // traite (à tort) les chiffres saisis comme déjà UTC
  const offsetMinutes = parisOffsetMinutesAt(naiveMs);
  return new Date(naiveMs - offsetMinutes * 60 * 1000).toISOString();
}

/** "JJ/MM HH:mm" en Europe/Paris — même format ré-implémenté 6 fois (extrait
 *  de lib/queries/match-bets.ts, aussi dupliqué dans admin-requests.ts,
 *  admin-resolution.ts, admin-validation.ts, bets.ts, my-bets.ts) avant
 *  cette extraction (16/08/2026, bug d'audit corrigé). */
export function parisDateTimeLabel(iso: string): string {
  const date = new Date(iso);
  const datePart = new Intl.DateTimeFormat("fr-FR", { timeZone: DAY_TIMEZONE, day: "2-digit", month: "2-digit" }).format(date);
  const timePart = new Intl.DateTimeFormat("fr-FR", { timeZone: DAY_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${datePart} ${timePart}`;
}

function parisOffsetMinutesAt(atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DAY_TIMEZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(atMs));
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = /GMT([+-]\d+)(?::(\d+))?/.exec(tzName);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}
