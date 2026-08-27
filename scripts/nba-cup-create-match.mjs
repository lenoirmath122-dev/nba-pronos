#!/usr/bin/env node
// ============================================================================
// NBA CUP ALPHA — (b) Crée un match fictif à l'avance (SCHEDULED, invisible)
// ============================================================================
// Fichier  : scripts/nba-cup-create-match.mjs
// Usage    : node --env-file=.env.local scripts/nba-cup-create-match.mjs \
//              --series=<seriesId> --game=<game_id réel choisi> --at="2026-09-20T20:00"
//
// Contexte : voir scripts/nba-cup-find-real-game.mjs (même chantier alpha).
// Ce script prépare le match sans jamais révéler le résultat : statut
// SCHEDULED (invisible dans Résultats, cf. lib/queries/play.ts::
// fetchLockedRows — un match FINISHED n'a AUCUNE borne sur scheduled_at,
// donc ne JAMAIS créer directement en FINISHED ici). Le vrai score/les
// vraies stats ne sont appliqués QUE par scripts/nba-cup-reveal-match.mjs,
// le jour J.
//
// --at : heure MURALE Paris (comme le formulaire admin), convertie via
// parisLocalToUtcIso() (lib/dates/paris.ts — module neutre, aucun
// server-only, importable directement dans un script Node autonome).
//
// NBA_CUP : 1 SEUL match par série (lib/scoring/engine.ts::
// deriveSeriesOutcome, branche NBA_CUP) — jamais de best-of-7 ici,
// game_number toujours 1, garde anti-doublon ci-dessous.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { parisLocalToUtcIso } from "../lib/dates/paris.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/nba-cup-create-match.mjs --series=... --game=... --at=...)"
  );
}

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    const m = /^--([a-zA-Z]+)=(.*)$/.exec(raw);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const seriesId = args.series;
const realGameId = args.game;
const atLocal = args.at;

if (!seriesId || !realGameId || !atLocal) {
  throw new Error('Usage : --series=<seriesId> --game=<game_id réel> --at="2026-09-20T20:00" (heure Paris)');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function recomputeBracketDeadline(competitionId) {
  const { data: earliest } = await supabase
    .from("matches")
    .select("scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  await supabase.from("competitions").update({ bracket_deadline: earliest?.scheduled_at ?? null }).eq("id", competitionId);
}

async function main() {
  const { data: series, error: seriesError } = await supabase
    .from("series")
    .select("id, competition_id, round, team1_id, team2_id, official_status")
    .eq("id", seriesId)
    .single();
  if (seriesError || !series) throw new Error(`Série introuvable : ${seriesError?.message ?? seriesId}`);
  if (!series.team1_id || !series.team2_id) {
    throw new Error("Les 2 équipes de cette série ne sont pas encore connues (tour précédent pas encore révélé).");
  }
  if (series.official_status === "FINISHED" || series.official_status === "CANCELLED") {
    throw new Error("Cette série est déjà terminée.");
  }

  const { count: existingCount, error: countError } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("series_id", seriesId);
  if (countError) throw new Error(`Vérification doublon : ${countError.message}`);
  if ((existingCount ?? 0) > 0) {
    throw new Error(`Un match existe déjà pour la série ${seriesId} (NBA_CUP = 1 seul match/série).`);
  }

  const { data: realGame, error: realGameError } = await supabase
    .from("stats_matchs")
    .select("game_id")
    .eq("game_id", realGameId)
    .maybeSingle();
  if (realGameError) throw new Error(`Vérification du game_id réel : ${realGameError.message}`);
  if (!realGame) throw new Error(`game_id "${realGameId}" introuvable dans stats_matchs.`);

  const scheduledAt = parisLocalToUtcIso(atLocal);

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      competition_id: series.competition_id,
      series_id: seriesId,
      game_number: 1,
      scheduled_at: scheduledAt,
      status: "SCHEDULED",
      home_team_id: series.team1_id,
      away_team_id: series.team2_id,
    })
    .select("id")
    .single();
  if (matchError || !match) throw new Error(`Création du match : ${matchError?.message}`);

  const { error: mappingError } = await supabase.from("entity_mappings").insert({
    entity_type: "MATCH",
    internal_id: match.id,
    source_type: "NBA_API",
    source_ref: realGameId,
    status: "CONFIRMED",
    confirmed_at: new Date().toISOString(),
  });
  if (mappingError) throw new Error(`entity_mappings : ${mappingError.message}`);

  await recomputeBracketDeadline(series.competition_id);

  console.log(`OK — match créé (${match.id}) pour la série ${series.round} (${seriesId}), programmé le ${scheduledAt} (UTC).`);
  console.log(`OK — lié au vrai match ${realGameId} (entity_mappings), invisible tant qu'il n'est pas révélé.`);
  console.log(`\nLe jour J : node --env-file=.env.local scripts/nba-cup-reveal-match.mjs --match=${match.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
