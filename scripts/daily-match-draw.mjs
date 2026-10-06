#!/usr/bin/env node
// ============================================================================
// MATCH DU JOUR (DAILY_MATCH) — tirage d'un match NBA par jour, par lots
// ============================================================================
// Fichier  : scripts/daily-match-draw.mjs
// Usage    : node --conditions=react-server --env-file=.env.local \
//              scripts/daily-match-draw.mjs --from=2026-10-20 --to=2026-10-29 [--dry-run] [--seed=<hex>]
//              [--min-remaining=20]
//
// `--conditions=react-server` : lib/nba/client.ts (seul module autorisé à
// appeler Highlightly, règle C-1) importe "server-only", qui n'a une version
// vide que sous cette condition. Sans elle, l'import lève une erreur.
//
// Pour chaque jour NY du lot : 1 appel Highlightly, filtre des candidats
// (30 franchises mappées, statut SCHEDULED, bon jour NY, pas déjà mappé),
// tirage aléatoire pur parmi eux (lib/dailyMatch/draw.ts), puis création de :
//   série technique (round DAILY, slot_index = YYYYMMDD du jour NY, équipes
//   du match) -> match (game_number 1) -> entity_mappings (HIGHLIGHTLY)
// et une ligne audit_logs DAILY_MATCH_DRAW (graine, candidats, index tiré).
//
// - Idempotent : un jour qui a déjà une série ET un match est sauté. Pas de
//   retirage (décision utilisateur du 07/10/2026) : un match tiré ne change plus.
// - --dry-run : aucune écriture, mais consomme le même quota API. Avec la même
//   --seed, le résultat est identique SEULEMENT si le calendrier n'a pas bougé.
// - Un lot = 10 jours max (quota API) ; à lancer un soir où les crons
//   consomment peu. S'arrête si le quota restant passe sous --min-remaining.
// - Publication aux joueurs : 10h Paris le jour NY du match, filtrée côté
//   serveur (lib/dates/paris.ts::isDailyDayPublished) — rien à faire ici.
// ============================================================================

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getMatchesByDate, normalizeMatchStatus } from "../lib/nba/client.ts";
import { dailyPublishAt, isDailyDayPublished, nyDayToSlot } from "../lib/dates/paris.ts";
import { daySeed, daysBetween, filterCandidates, pickCandidate, validateRange } from "../lib/dailyMatch/draw.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées (node --env-file=.env.local ...)."
  );
}

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    const m = /^--([a-zA-Z-]+)(?:=(.*))?$/.exec(raw);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const dryRun = args["dry-run"] === true;
const minRemaining = args["min-remaining"] ? Number(args["min-remaining"]) : 20;
const runSeed = typeof args.seed === "string" ? args.seed : randomBytes(16).toString("hex");

if (typeof args.from !== "string" || typeof args.to !== "string") {
  throw new Error("Usage : --from=YYYY-MM-DD --to=YYYY-MM-DD [--dry-run] [--seed=<hex>] [--min-remaining=20]");
}
if (!Number.isFinite(minRemaining)) throw new Error("--min-remaining doit être un nombre.");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function must({ data, error }, what) {
  if (error) throw new Error(`${what} : ${error.message}`);
  return data;
}

async function main() {
  const errors = validateRange(args.from, args.to, (day) => isDailyDayPublished(day, Date.now()));
  if (errors.length > 0) throw new Error(errors.join("\n"));

  // Affichée AVANT tout appel : si le run est interrompu, elle reste notée.
  console.log(`Graine du run : ${runSeed}${dryRun ? "  (--dry-run : aucune écriture)" : ""}`);

  const competition = must(
    await supabase.from("competitions").select("id, name, type").eq("status", "ACTIVE").maybeSingle(),
    "Compétition active"
  );
  if (!competition) throw new Error("Aucune compétition ACTIVE.");
  if (competition.type !== "DAILY_MATCH") {
    throw new Error(`La compétition active "${competition.name}" est de type ${competition.type}, pas DAILY_MATCH.`);
  }

  const teamMaps = must(
    await supabase.from("entity_mappings").select("internal_id, source_ref").eq("entity_type", "TEAM").eq("source_type", "HIGHLIGHTLY"),
    "Mappings équipes"
  );
  const teamIdByRef = new Map(teamMaps.map((r) => [r.source_ref, r.internal_id]));
  const matchMaps = must(
    await supabase.from("entity_mappings").select("source_ref").eq("entity_type", "MATCH").eq("source_type", "HIGHLIGHTLY"),
    "Mappings matchs"
  );
  const mappedMatchRefs = new Set(matchMaps.map((r) => r.source_ref));

  const existingSeries = must(
    await supabase.from("series").select("id, slot_index").eq("competition_id", competition.id).eq("round", "DAILY"),
    "Séries existantes"
  );
  const seriesBySlot = new Map(existingSeries.map((s) => [s.slot_index, s.id]));

  let drawn = 0;
  let skipped = 0;
  let empty = 0;
  for (const day of daysBetween(args.from, args.to)) {
    const slot = nyDayToSlot(day);
    const seriesId = seriesBySlot.get(slot);
    if (seriesId) {
      const { count } = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("series_id", seriesId);
      if ((count ?? 0) > 0) {
        console.log(`${day} : déjà tiré, sauté.`);
        skipped++;
        continue;
      }
      // Série sans match (run interrompu) : on la réutilise plus bas.
    }

    const { data: apiMatches, requestsRemaining } = await getMatchesByDate(day);
    const candidates = filterCandidates(
      apiMatches.map((m) => ({
        id: m.id,
        date: m.date,
        statusDescription: m.state.description,
        homeRef: String(m.homeTeam.id),
        awayRef: String(m.awayTeam.id),
      })),
      {
        day,
        teamIdByRef,
        mappedMatchRefs,
        isScheduled: (d) => {
          const n = normalizeMatchStatus(d);
          return n.recognized && n.status === "SCHEDULED";
        },
      }
    );
    const picked = pickCandidate(candidates, daySeed(runSeed, day));
    if (!picked) {
      console.log(`${day} : aucun match candidat (calendrier vide ou pas encore publié), sauté.`);
      empty++;
    } else {
      const c = picked.candidate;
      console.log(
        `${day} : ${picked.index + 1}/${candidates.length} -> match Highlightly #${c.id} (${c.homeRef} vs ${c.awayRef}), ` +
          `${c.date}, publié le ${dailyPublishAt(day)}`
      );
      if (!dryRun) {
        await writeDraw({ competitionId: competition.id, day, slot, seriesId, picked, candidates, requestsRemaining });
        mappedMatchRefs.add(String(c.id));
      }
      drawn++;
    }

    if (requestsRemaining != null && requestsRemaining < minRemaining) {
      console.log(`\nQuota API restant : ${requestsRemaining} (< ${minRemaining}). Arrêt du lot après ${day}.`);
      break;
    }
  }

  console.log(`\nTerminé : ${drawn} tiré(s)${dryRun ? " (simulation)" : ""}, ${skipped} déjà tiré(s), ${empty} sans candidat.`);
}

async function writeDraw({ competitionId, day, slot, seriesId, picked, candidates, requestsRemaining }) {
  const c = picked.candidate;

  let sid = seriesId;
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
    );
    sid = created.id;
  } else {
    must(await supabase.from("series").update({ team1_id: c.homeTeamId, team2_id: c.awayTeamId }).eq("id", sid), `Série ${day}`);
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
  );

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
        runSeed,
        day,
        candidates: candidates.map((x) => x.id),
        pickedIndex: picked.index,
        highlightlyId: c.id,
        matchId: match.id,
        requestsRemaining,
        source: "script",
      },
    }),
    `Journal ${day}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
