#!/usr/bin/env node
// Provisionne les fixtures du test de charge (option 1 révisée, cf. discussion
// "capacité max" du 11/09/2026) : N utilisateurs de test + une série/match
// PLAYOFFS pour exercer save_bet (RPC utilisé par lib/actions/bets.ts).
//
// Cible le projet Supabase cloud DÉDIÉ au load test (pas de Docker local --
// abandonné après BSOD/RAM saturée, voir mémoire projet), et surtout PAS la
// prod : refuse de tourner si l'URL pointe vers le projet de prod
// (lcldekiwinggyqgbmlwc). Idempotent : relançable sans dupliquer les fixtures.
//
// Usage :
//   LOAD_TEST_SERVICE_ROLE_KEY=sb_secret_... node load-test/setup.mjs

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROD_PROJECT_REF = "lcldekiwinggyqgbmlwc";
const SUPABASE_URL = process.env.LOAD_TEST_SUPABASE_URL ?? "https://kolbvdobcheedswsufgv.supabase.co";
const SERVICE_ROLE_KEY = process.env.LOAD_TEST_SERVICE_ROLE_KEY;
const USER_COUNT = Number(process.env.LOAD_TEST_USER_COUNT ?? 200);
const PASSWORD = "LoadTest!2026";

if (SUPABASE_URL.includes(PROD_PROJECT_REF)) {
  console.error(`Refus : SUPABASE_URL pointe vers le projet de PROD (${SUPABASE_URL}).`);
  console.error("Ce script ne doit jamais tourner contre le projet Supabase de prod.");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("LOAD_TEST_SERVICE_ROLE_KEY manquante (clé secret du projet load-test, dashboard Settings > API).");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureTeams() {
  const { data: existing, error } = await admin.from("teams").select("id, abbreviation").limit(2);
  if (error) throw new Error(`Lecture teams : ${error.message}`);
  if (existing.length >= 2) return [existing[0].id, existing[1].id];

  const { data: created, error: insertError } = await admin
    .from("teams")
    .upsert(
      [
        { name: "Load Test A", abbreviation: "LTA", conference: "EAST" },
        { name: "Load Test B", abbreviation: "LTB", conference: "WEST" },
      ],
      { onConflict: "abbreviation" },
    )
    .select("id");
  if (insertError) throw new Error(`Création teams : ${insertError.message}`);
  return created.map((t) => t.id);
}

async function ensureCompetition() {
  const { data: active, error } = await admin
    .from("competitions")
    .select("id")
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error) throw new Error(`Lecture competitions : ${error.message}`);
  if (active) return active.id;

  const { data: created, error: insertError } = await admin
    .from("competitions")
    .insert({ name: "Load Test Competition", type: "PLAYOFFS", status: "ACTIVE" })
    .select("id")
    .single();
  if (insertError) throw new Error(`Création competition : ${insertError.message}`);
  return created.id;
}

// slot_index 9999 sert de marqueur pour retrouver/réutiliser la série de test
// entre deux exécutions du script sans dupliquer les fixtures.
const LOAD_TEST_SLOT_INDEX = 9999;

async function ensureSeries(competitionId, [team1Id, team2Id]) {
  const { data: existing, error } = await admin
    .from("series")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("slot_index", LOAD_TEST_SLOT_INDEX)
    .maybeSingle();
  if (error) throw new Error(`Lecture series : ${error.message}`);
  if (existing) return existing.id;

  const { data: created, error: insertError } = await admin
    .from("series")
    .insert({
      competition_id: competitionId,
      round: "ROUND_1",
      conference: "EAST",
      slot_index: LOAD_TEST_SLOT_INDEX,
      team1_id: team1Id,
      team2_id: team2Id,
      official_status: "SCHEDULED",
      official_score_format: "4-0",
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`Création series : ${insertError.message}`);
  return created.id;
}

async function ensureMatch(competitionId, seriesId, [team1Id, team2Id]) {
  const { data: existing, error } = await admin
    .from("matches")
    .select("id")
    .eq("series_id", seriesId)
    .eq("game_number", 1)
    .maybeSingle();
  if (error) throw new Error(`Lecture matches : ${error.message}`);
  if (existing) return existing.id;

  // Deadline (bet_deadline_open) ouverte : scheduled_at dans le futur.
  const scheduledAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const { data: created, error: insertError } = await admin
    .from("matches")
    .insert({
      competition_id: competitionId,
      series_id: seriesId,
      game_number: 1,
      scheduled_at: scheduledAt,
      status: "SCHEDULED",
      home_team_id: team1Id,
      away_team_id: team2Id,
    })
    .select("id")
    .single();
  if (insertError) throw new Error(`Création match : ${insertError.message}`);
  return created.id;
}

async function ensureUsers() {
  const users = [];
  for (let i = 1; i <= USER_COUNT; i++) {
    const email = `loadtest-${String(i).padStart(4, "0")}@test.local`;
    const pseudo = `LoadTest${String(i).padStart(4, "0")}`;
    const { error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { pseudo },
    });
    if (error && !/already.*registered/i.test(error.message)) {
      throw new Error(`Création ${email} : ${error.message}`);
    }
    users.push({ email, password: PASSWORD });
    if (i % 50 === 0) console.log(`  ${i}/${USER_COUNT} utilisateurs...`);
  }
  return users;
}

async function main() {
  console.log(`Fixtures contre ${SUPABASE_URL} (projet cloud dédié load-test)`);

  const teamIds = await ensureTeams();
  const competitionId = await ensureCompetition();
  const seriesId = await ensureSeries(competitionId, teamIds);
  const matchId = await ensureMatch(competitionId, seriesId, teamIds);
  console.log(`Compétition ${competitionId} / série ${seriesId} / match ${matchId} prêts.`);

  console.log(`Création/vérification de ${USER_COUNT} utilisateurs de test...`);
  const users = await ensureUsers();

  writeFileSync(join(__dirname, "fixtures.json"), JSON.stringify({ competitionId, seriesId, matchId }, null, 2));
  writeFileSync(join(__dirname, "users.json"), JSON.stringify(users, null, 2));
  console.log(`OK — load-test/users.json (${users.length}) et load-test/fixtures.json écrits.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
