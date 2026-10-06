// Tirage du Match du jour (DAILY_MATCH) : logique PURE, partagée par
// scripts/daily-match-draw.mjs et les tests. Aucun import relatif — Node
// charge ce fichier tel quel (comme lib/dates/paris.ts), sans bundler.
//
// Tirage aléatoire pur (cadrage §8.3) mais REPRODUCTIBLE : la graine de run
// est journalisée, et la graine d'un jour dépend du jour — rejouer un jour
// seul donne le même résultat que dans un lot, tant que le calendrier de
// l'API n'a pas changé.

export const DAILY_MATCH_FIRST_DAY = "2026-10-20";
export const DAILY_MATCH_LAST_DAY = "2026-11-27";
export const MAX_DRAW_DAYS = 10;

const NY_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });

export type DrawMatch = {
  id: number;
  date: string; // ISO UTC
  statusDescription: string;
  homeRef: string; // id Highlightly de l'équipe
  awayRef: string;
};

export type Candidate = DrawMatch & { homeTeamId: string; awayTeamId: string };

/** cyrb53 : hash de chaîne -> entier 53 bits (suffisant pour amorcer le PRNG). */
export function hashSeed(seed: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 amorcé par hashSeed(seed) : suite pseudo-aléatoire dans [0, 1). */
export function makeRng(seed: string): () => number {
  let a = hashSeed(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function daySeed(runSeed: string, day: string): string {
  return `${runSeed}:${day}`;
}

export function nyDayOf(isoDate: string): string {
  return NY_DATE_FORMATTER.format(new Date(isoDate));
}

export type FilterContext = {
  day: string; // jour NY visé, YYYY-MM-DD
  teamIdByRef: Map<string, string>; // 30 franchises mappées
  mappedMatchRefs: Set<string>; // ids Highlightly déjà dans entity_mappings
  isScheduled: (statusDescription: string) => boolean; // injecté (vit dans lib/nba/client.ts)
};

/** Candidats du jour, triés par id croissant (l'ordre de l'API n'est pas garanti). */
export function filterCandidates(raw: DrawMatch[], ctx: FilterContext): Candidate[] {
  const seen = new Set<number>();
  const out: Candidate[] = [];
  for (const m of raw) {
    if (seen.has(m.id)) continue;
    const homeTeamId = ctx.teamIdByRef.get(m.homeRef);
    const awayTeamId = ctx.teamIdByRef.get(m.awayRef);
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) continue;
    if (!ctx.isScheduled(m.statusDescription)) continue;
    if (nyDayOf(m.date) !== ctx.day) continue;
    if (ctx.mappedMatchRefs.has(String(m.id))) continue;
    seen.add(m.id);
    out.push({ ...m, homeTeamId, awayTeamId });
  }
  return out.sort((a, b) => a.id - b.id);
}

export function pickCandidate(candidates: Candidate[], seed: string): { index: number; candidate: Candidate } | null {
  if (candidates.length === 0) return null;
  const index = Math.floor(makeRng(seed)() * candidates.length);
  return { index, candidate: candidates[index] };
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Jours YYYY-MM-DD de `from` à `to` inclus. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Erreurs de validation d'un lot (liste vide = valide). `isPublished` : jours
 *  déjà publiés, qu'on ne tire plus (un joueur a pu les voir). */
export function validateRange(from: string, to: string, isPublished: (day: string) => boolean): string[] {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) return ["--from et --to doivent être au format YYYY-MM-DD."];
  const errors: string[] = [];
  if (from > to) errors.push("--from doit être <= --to.");
  if (from < DAILY_MATCH_FIRST_DAY) errors.push(`--from avant le premier jour de la compétition (${DAILY_MATCH_FIRST_DAY}).`);
  if (to > DAILY_MATCH_LAST_DAY) errors.push(`--to après le dernier jour de la compétition (${DAILY_MATCH_LAST_DAY}).`);
  if (errors.length > 0) return errors;
  const days = daysBetween(from, to);
  if (days.length > MAX_DRAW_DAYS) errors.push(`${days.length} jours demandés, maximum ${MAX_DRAW_DAYS} par lot (quota API).`);
  const published = days.filter(isPublished);
  if (published.length > 0) errors.push(`Jours déjà publiés, non tirables : ${published.join(", ")}.`);
  return errors;
}
