// Tirage du Match du jour (DAILY_MATCH), partagé par scripts/daily-match-draw.mjs,
// la route /api/daily-match/draw et les tests. Aucun import d'exécution — Node
// charge ce fichier tel quel (comme lib/dates/paris.ts), sans bundler : tout
// ce qui a un effet de bord (Supabase, API Highlightly, horloge) est injecté
// dans runDailyDraw via `deps`.
//
// Tirage aléatoire pur (cadrage §8.3) mais REPRODUCTIBLE : la graine de run
// est journalisée, et la graine d'un jour dépend du jour — rejouer un jour
// seul donne le même résultat que dans un lot, tant que le calendrier de
// l'API n'a pas changé.

export const DAILY_MATCH_FIRST_DAY = "2026-10-20";
export const DAILY_MATCH_LAST_DAY = "2026-11-27";
export const MAX_DRAW_DAYS = 10;
// Le cron commence à tirer 2 jours avant le premier jour (décision 07/10/2026) :
// il tire alors les jours >= FIRST_DAY de sa fenêtre, sans toucher aux autres.
export const DAILY_MATCH_CRON_START = "2026-10-18";
export const DRAW_AHEAD_DAYS = 3;
export const CRON_MIN_REMAINING = 50;

import type { SupabaseClient } from "@supabase/supabase-js";

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

/** Validation d'un lot manuel (route). Avec `override`, on ignore les bornes de
 *  la compétition et le contrôle « publié » (test sur un jour déjà publié) ;
 *  format, ordre et taille du lot restent contrôlés. */
export function validateManualRange(
  from: string,
  to: string,
  opts: { override: boolean; isPublished: (day: string) => boolean }
): string[] {
  if (!opts.override) return validateRange(from, to, opts.isPublished);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) return ["from et to doivent être au format YYYY-MM-DD."];
  if (from > to) return ["from doit être <= to."];
  const n = daysBetween(from, to).length;
  return n > MAX_DRAW_DAYS ? [`${n} jours demandés, maximum ${MAX_DRAW_DAYS} par lot (quota API).`] : [];
}

/** Jours à tirer par le cron, d'après la DATE PARIS du moment (le jour NY D est
 *  publié à 10h Paris le D : la date NY du moment, encore D-1 tôt le matin, ne
 *  convient pas). Rien avant DAILY_MATCH_CRON_START ni après LAST_DAY. */
export function cronDrawDays(todayParis: string, isPublished: (day: string) => boolean): string[] {
  if (todayParis < DAILY_MATCH_CRON_START || todayParis > DAILY_MATCH_LAST_DAY) return [];
  return daysBetween(todayParis, addDays(todayParis, DRAW_AHEAD_DAYS - 1)).filter(
    (day) => day >= DAILY_MATCH_FIRST_DAY && day <= DAILY_MATCH_LAST_DAY && !isPublished(day)
  );
}

export type DrawApiMatch = {
  id: number;
  date: string;
  state: { description: string };
  homeTeam: { id: number | string };
  awayTeam: { id: number | string };
};

export type DrawDeps = {
  supabase: SupabaseClient;
  fetchDay: (day: string) => Promise<{ data: DrawApiMatch[]; requestsRemaining: number | null }>;
  isScheduled: (statusDescription: string) => boolean;
  toSlot: (day: string) => number;
  publishAt: (day: string) => string;
  log: (message: string) => void;
};

export type DrawOptions = {
  days: string[];
  dryRun: boolean;
  runSeed: string;
  minRemaining: number;
  source: "script" | "cron" | "manual";
};

export type DrawResult = {
  runSeed: string;
  drawn: string[];
  skipped: string[];
  empty: string[];
  stoppedOnQuota: boolean;
};

function must<T>({ data, error }: { data: T; error: { message: string } | null }, what: string): T {
  if (error) throw new Error(`${what} : ${error.message}`);
  return data;
}

/** Orchestration du tirage : compétition ACTIVE DAILY_MATCH, puis par jour 1 appel
 *  API, tirage, écriture série -> match -> mapping -> audit. Idempotent. */
export async function runDailyDraw(deps: DrawDeps, opts: DrawOptions): Promise<DrawResult> {
  const { supabase, log } = deps;
  const competition = must(
    await supabase.from("competitions").select("id, name, type").eq("status", "ACTIVE").maybeSingle(),
    "Compétition active"
  ) as { id: string; name: string; type: string } | null;
  if (!competition) throw new Error("Aucune compétition ACTIVE.");
  if (competition.type !== "DAILY_MATCH") {
    throw new Error(`La compétition active "${competition.name}" est de type ${competition.type}, pas DAILY_MATCH.`);
  }

  const teamMaps = must(
    await supabase.from("entity_mappings").select("internal_id, source_ref").eq("entity_type", "TEAM").eq("source_type", "HIGHLIGHTLY"),
    "Mappings équipes"
  ) as { internal_id: string; source_ref: string }[];
  const teamIdByRef = new Map(teamMaps.map((r) => [r.source_ref, r.internal_id]));
  const matchMaps = must(
    await supabase.from("entity_mappings").select("source_ref").eq("entity_type", "MATCH").eq("source_type", "HIGHLIGHTLY"),
    "Mappings matchs"
  ) as { source_ref: string }[];
  const mappedMatchRefs = new Set(matchMaps.map((r) => r.source_ref));

  const existingSeries = must(
    await supabase.from("series").select("id, slot_index").eq("competition_id", competition.id).eq("round", "DAILY"),
    "Séries existantes"
  ) as { id: string; slot_index: number }[];
  const seriesBySlot = new Map(existingSeries.map((s) => [s.slot_index, s.id]));

  const result: DrawResult = { runSeed: opts.runSeed, drawn: [], skipped: [], empty: [], stoppedOnQuota: false };
  for (const day of opts.days) {
    const slot = deps.toSlot(day);
    const seriesId = seriesBySlot.get(slot);
    if (seriesId) {
      const { count } = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("series_id", seriesId);
      if ((count ?? 0) > 0) {
        log(`${day} : déjà tiré, sauté.`);
        result.skipped.push(day);
        continue;
      }
      // Série sans match (run interrompu) : on la réutilise plus bas.
    }

    const { data: apiMatches, requestsRemaining } = await deps.fetchDay(day);
    const candidates = filterCandidates(
      apiMatches.map((m) => ({
        id: m.id,
        date: m.date,
        statusDescription: m.state.description,
        homeRef: String(m.homeTeam.id),
        awayRef: String(m.awayTeam.id),
      })),
      { day, teamIdByRef, mappedMatchRefs, isScheduled: deps.isScheduled }
    );
    const picked = pickCandidate(candidates, daySeed(opts.runSeed, day));
    if (!picked) {
      log(`${day} : aucun match candidat (calendrier vide ou pas encore publié), sauté.`);
      result.empty.push(day);
    } else {
      const c = picked.candidate;
      log(
        `${day} : ${picked.index + 1}/${candidates.length} -> match Highlightly #${c.id} (${c.homeRef} vs ${c.awayRef}), ` +
          `${c.date}, publié le ${deps.publishAt(day)}`
      );
      if (!opts.dryRun) {
        await writeDraw(deps, opts, { competitionId: competition.id, day, slot, seriesId, picked, candidates, requestsRemaining });
        mappedMatchRefs.add(String(c.id));
      }
      result.drawn.push(day);
    }

    if (requestsRemaining != null && requestsRemaining < opts.minRemaining) {
      log(`Quota API restant : ${requestsRemaining} (< ${opts.minRemaining}). Arrêt du lot après ${day}.`);
      result.stoppedOnQuota = true;
      break;
    }
  }
  return result;
}

async function writeDraw(
  deps: DrawDeps,
  opts: DrawOptions,
  args: {
    competitionId: string;
    day: string;
    slot: number;
    seriesId: string | undefined;
    picked: { index: number; candidate: Candidate };
    candidates: Candidate[];
    requestsRemaining: number | null;
  }
): Promise<void> {
  const { supabase } = deps;
  const { competitionId, day, slot, picked, candidates, requestsRemaining } = args;
  const c = picked.candidate;

  let sid = args.seriesId;
  if (!sid) {
    const created = must(
      await supabase
        .from("series")
        .insert({
          competition_id: competitionId,
          round: "DAILY",
          conference: null,
          slot_index: slot,
          team1_id: c.homeTeamId,
          team2_id: c.awayTeamId,
        })
        .select("id")
        .single(),
      `Création série ${day}`
    ) as { id: string };
    sid = created.id;
  }

  const match = must(
    await supabase
      .from("matches")
      .insert({
        competition_id: competitionId,
        series_id: sid,
        game_number: 1,
        scheduled_at: c.date,
        status: "SCHEDULED",
        home_team_id: c.homeTeamId,
        away_team_id: c.awayTeamId,
      })
      .select("id")
      .single(),
    `Création match ${day}`
  ) as { id: string };

  // Série réutilisée : équipes mises à jour APRÈS l'insertion du match, pour
  // qu'une course entre deux exécutions (unique series_id + game_number) n'écrase
  // pas les équipes de la série du match gagnant.
  if (args.seriesId) {
    must(await supabase.from("series").update({ team1_id: c.homeTeamId, team2_id: c.awayTeamId }).eq("id", sid), `Série ${day}`);
  }

  // Un match sans mapping ne serait jamais synchronisé (ni horaire ni score) :
  // en cas d'échec on le supprime plutôt que de le laisser orphelin.
  const { error: mappingError } = await supabase.from("entity_mappings").insert({
    entity_type: "MATCH",
    internal_id: match.id,
    source_type: "HIGHLIGHTLY",
    source_ref: String(c.id),
    status: "CONFIRMED",
    confirmed_at: new Date().toISOString(),
  });
  if (mappingError) {
    await supabase.from("matches").delete().eq("id", match.id);
    throw new Error(`entity_mappings ${day} : ${mappingError.message} (match supprimé, relancer le jour).`);
  }

  // NB : volontairement PAS de recomputeBracketDeadline (nba-cup-create-match.mjs) :
  // le Match du jour n'a pas de bracket, bracket_deadline doit rester NULL.
  must(
    await supabase.from("audit_logs").insert({
      actor_user_id: null,
      action: "DAILY_MATCH_DRAW",
      target_type: "series",
      target_id: sid,
      after_value: {
        runSeed: opts.runSeed,
        day,
        candidates: candidates.map((x) => x.id),
        pickedIndex: picked.index,
        highlightlyId: c.id,
        matchId: match.id,
        requestsRemaining,
        source: opts.source,
      },
    }),
    `Journal ${day}`
  );
}
