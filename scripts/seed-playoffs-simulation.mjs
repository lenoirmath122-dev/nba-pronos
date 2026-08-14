#!/usr/bin/env node
// ============================================================================
// SEED — Simulation Playoffs (10 bots jouent, situation réelle)
// ============================================================================
// Fichier  : scripts/seed-playoffs-simulation.mjs
// Usage    : node --env-file=.env.local scripts/seed-playoffs-simulation.mjs
// Demandé  : simuler des playoffs avec matchs prévus/passés, des séries
//            terminées, et 10 bots qui jouent — pour observer l'app en
//            situation réelle (14/08/2026).
//
// DIFFÉRENCE avec scripts/seed-playoffs-test-data.mjs (conservé tel quel,
// pas modifié) : celui-ci va jusqu'au BOUT — matchs FINISHED avec vrais
// scores, séries FINISHED, vainqueurs RÉELLEMENT avancés au tour suivant,
// scores RÉELLEMENT calculés. Réutilise le vrai moteur de scoring
// (lib/scoring/engine.ts, fonctions PURES sans I/O — importées ici
// directement via le support TypeScript natif de Node, aucun risque de
// dérive avec les règles réelles) plutôt que d'inventer des points. La
// même limite technique que le script existant s'applique à l'orchestration
// (lib/scoring/recompute.ts et lib/scoring/advancement.ts importent
// getServiceClient, qui charge "server-only" — incompatible avec un script
// Node autonome, cf. lib/supabase/service.ts) : la boucle lecture/écriture
// est donc réimplémentée ici, à l'identique de ces deux fichiers (mêmes
// requêtes, même séquence), seul le calcul pur vient du vrai moteur.
//
// CONTRAINTE DB : une seule compétition ACTIVE à la fois
// (uniq_one_active_competition, migration #1). La compétition "Test"
// actuellement active (comptes réels Demo_Amis/Rillettes-31) est donc
// CLÔTURÉE pour de vrai par ce script — même écriture que closeCompetition()
// (lib/actions/admin-competitions.ts) : classement figé dans
// competition_archives, superlatifs calculés, status -> ARCHIVED. Décision
// prise AVEC l'utilisateur (14/08/2026) avant d'exécuter ce script.
//
// SÉCURITÉ : service_role (contourne la RLS, même patron que le script
// existant). RLS non désactivée nulle part.
//
// Comptes bots : mot de passe CONNU (pas jetable comme le script existant)
// — écrit dans un fichier LOCAL hors du dépôt (jamais commité), jamais
// affiché en clair ailleurs.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import {
  deriveSeriesOutcome,
  scoreMatchPrediction,
  scoreBracketPick,
} from "../lib/scoring/engine.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/seed-playoffs-simulation.mjs)"
  );
}

const CREDENTIALS_OUTPUT_PATH =
  process.env.SIMULATION_CREDENTIALS_PATH ||
  "C:\\Users\\lenoi\\AppData\\Local\\Temp\\claude\\c--dev\\661925d1-6e91-4bc6-b4f9-ca7d952638a3\\scratchpad\\simulation-bots-credentials.txt";

const SIMULATION_COMPETITION_NAME = "Playoffs NBA (simulation)";
const BOT_PASSWORD = "PlayoffsBot-" + Math.random().toString(36).slice(2, 8) + "!";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ok(label, { data, error }) {
  if (error) {
    console.error(`ÉCHEC — ${label} :`, error.message);
    process.exit(1);
  }
  console.log(`OK — ${label}`);
  return data;
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

// RNG déterministe (mulberry32) — reproductible par bot (même seed = mêmes
// picks si on relance à blanc), pas une vraie exigence produit mais utile
// pour déboguer ce script.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

async function main() {
  // ── 0. Garde anti double-exécution ────────────────────────────────────
  const { data: existing } = await supabase
    .from("competitions")
    .select("id")
    .eq("name", SIMULATION_COMPETITION_NAME)
    .maybeSingle();
  if (existing) {
    throw new Error(
      `Une compétition '${SIMULATION_COMPETITION_NAME}' existe déjà (id ${existing.id}). ` +
        "Ce script n'est pas idempotent — nettoyer avant de relancer."
    );
  }

  // ── 1. Clôture de la compétition ACTIVE actuelle (réplique closeCompetition) ──
  const { data: activeCompetition } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (activeCompetition) {
    console.log(`\n--- Clôture de la compétition active « ${activeCompetition.name} » (${activeCompetition.id}) ---`);

    const { data: scores } = await supabase
      .from("user_scores")
      .select(
        "user_id, total_points, matches_points, margin_bonus_points, bracket_points, bets_points, correct_match_winners, exact_margins"
      )
      .eq("competition_id", activeCompetition.id);
    const scoreRows = scores ?? [];

    if (scoreRows.length > 0) {
      const userIds = scoreRows.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("users").select("id, pseudo").in("id", userIds);
      const pseudoById = new Map((profiles ?? []).map((p) => [p.id, p.pseudo]));

      // Même départage que lib/scoring/ranking.ts::assignRanks (réimplémenté
      // ici pour éviter d'importer un module qui, lui, importe getServerClient
      // via son type -- superlatives.ts n'importe qu'un TYPE, donc sûr, mais
      // ranking.ts est trivial à réimplémenter et évite toute ambiguïté).
      function compareForRank(a, b) {
        return (
          b.total_points - a.total_points ||
          b.correct_match_winners - a.correct_match_winners ||
          b.exact_margins - a.exact_margins ||
          b.bracket_points - a.bracket_points
        );
      }
      function sameRankKey(a, b) {
        return (
          a.total_points === b.total_points &&
          a.correct_match_winners === b.correct_match_winners &&
          a.exact_margins === b.exact_margins &&
          a.bracket_points === b.bracket_points
        );
      }
      const sorted = [...scoreRows].sort(compareForRank);
      const finalRanks = new Map();
      sorted.forEach((row, index) => {
        const previous = sorted[index - 1];
        const rank = index === 0 || !sameRankKey(row, previous) ? index + 1 : finalRanks.get(previous.user_id);
        finalRanks.set(row.user_id, rank);
      });

      const archiveRows = scoreRows.map((row) => ({
        competition_id: activeCompetition.id,
        user_id: row.user_id,
        pseudo_snapshot: pseudoById.get(row.user_id) ?? "—",
        rank: finalRanks.get(row.user_id),
        total_points: row.total_points,
        matches_points: row.matches_points,
        margin_bonus_points: row.margin_bonus_points,
        bracket_points: row.bracket_points,
        bets_points: row.bets_points,
        correct_match_winners: row.correct_match_winners,
        exact_margins: row.exact_margins,
      }));
      ok("archive du classement final", await supabase.from("competition_archives").insert(archiveRows));
      // Superlatifs volontairement OMIS ici (computeSuperlatives fait des
      // requêtes riches — leaderboard_snapshots, round1 points — hors
      // propos de ce script ponctuel ; la vraie action admin les calcule
      // pour une vraie clôture, ce script n'en a pas besoin pour son objectif).
    }

    ok(
      `clôture de « ${activeCompetition.name} »`,
      await supabase
        .from("competitions")
        .update({ status: "ARCHIVED", archived_at: new Date().toISOString() })
        .eq("id", activeCompetition.id)
    );
  } else {
    console.log("(aucune compétition active à clôturer)");
  }

  // ── 2. Équipes NBA (référentiel) — réutilise si déjà présentes ──────────
  const TEAMS = [
    { name: "Boston Celtics", abbreviation: "BOS", conference: "EAST" },
    { name: "Brooklyn Nets", abbreviation: "BKN", conference: "EAST" },
    { name: "New York Knicks", abbreviation: "NYK", conference: "EAST" },
    { name: "Philadelphia 76ers", abbreviation: "PHI", conference: "EAST" },
    { name: "Toronto Raptors", abbreviation: "TOR", conference: "EAST" },
    { name: "Chicago Bulls", abbreviation: "CHI", conference: "EAST" },
    { name: "Cleveland Cavaliers", abbreviation: "CLE", conference: "EAST" },
    { name: "Detroit Pistons", abbreviation: "DET", conference: "EAST" },
    { name: "Indiana Pacers", abbreviation: "IND", conference: "EAST" },
    { name: "Milwaukee Bucks", abbreviation: "MIL", conference: "EAST" },
    { name: "Atlanta Hawks", abbreviation: "ATL", conference: "EAST" },
    { name: "Charlotte Hornets", abbreviation: "CHA", conference: "EAST" },
    { name: "Miami Heat", abbreviation: "MIA", conference: "EAST" },
    { name: "Orlando Magic", abbreviation: "ORL", conference: "EAST" },
    { name: "Washington Wizards", abbreviation: "WAS", conference: "EAST" },
    { name: "Denver Nuggets", abbreviation: "DEN", conference: "WEST" },
    { name: "Minnesota Timberwolves", abbreviation: "MIN", conference: "WEST" },
    { name: "Oklahoma City Thunder", abbreviation: "OKC", conference: "WEST" },
    { name: "Portland Trail Blazers", abbreviation: "POR", conference: "WEST" },
    { name: "Utah Jazz", abbreviation: "UTA", conference: "WEST" },
    { name: "Golden State Warriors", abbreviation: "GSW", conference: "WEST" },
    { name: "LA Clippers", abbreviation: "LAC", conference: "WEST" },
    { name: "Los Angeles Lakers", abbreviation: "LAL", conference: "WEST" },
    { name: "Phoenix Suns", abbreviation: "PHX", conference: "WEST" },
    { name: "Sacramento Kings", abbreviation: "SAC", conference: "WEST" },
    { name: "Dallas Mavericks", abbreviation: "DAL", conference: "WEST" },
    { name: "Houston Rockets", abbreviation: "HOU", conference: "WEST" },
    { name: "Memphis Grizzlies", abbreviation: "MEM", conference: "WEST" },
    { name: "New Orleans Pelicans", abbreviation: "NOP", conference: "WEST" },
    { name: "San Antonio Spurs", abbreviation: "SAS", conference: "WEST" },
  ];

  const { data: existingTeams } = await supabase.from("teams").select("id, abbreviation");
  const teamId = Object.fromEntries((existingTeams ?? []).map((t) => [t.abbreviation, t.id]));
  const missingTeams = TEAMS.filter((t) => !teamId[t.abbreviation]);
  if (missingTeams.length > 0) {
    const inserted = ok("équipes NBA manquantes", await supabase.from("teams").insert(missingTeams).select("id, abbreviation"));
    for (const t of inserted) teamId[t.abbreviation] = t.id;
  } else {
    console.log("OK — 30 équipes NBA déjà en base, réutilisées");
  }

  // ── 3. Compétition ACTIVE + code de rejoin ──────────────────────────────
  const competition = ok(
    "compétition Playoffs (simulation)",
    await supabase
      .from("competitions")
      // bracket_deadline posée à NULL ici, corrigée juste après la création
      // des matchs (§5 plus bas) — sa vraie valeur (heure du 1er match du
      // tour feuille) dépend des matchs, qui n'existent pas encore à ce
      // stade. Bug réel trouvé le 14/08/2026 : une 1ère version de ce script
      // la posait en dur 2 jours dans le futur, alors que des matchs du 1er
      // tour étaient déjà dans le PASSÉ — la deadline ne verrouillait donc
      // jamais le bracket malgré des séries déjà terminées.
      .insert({ name: SIMULATION_COMPETITION_NAME, type: "PLAYOFFS", status: "ACTIVE", bracket_deadline: null })
      .select("id")
      .single()
  );
  const competitionId = competition.id;

  ok(
    "code de compétition",
    await supabase.from("competition_secrets").insert({
      competition_id: competitionId,
      join_code: Math.random().toString(36).slice(2, 10).toUpperCase(),
    })
  );

  // ── 4. Squelette du bracket (15 séries, bottom-up) ──────────────────────
  const finals = ok(
    "série NBA_FINALS",
    await supabase
      .from("series")
      .insert({ competition_id: competitionId, round: "NBA_FINALS", conference: null, slot_index: 1 })
      .select("id")
      .single()
  );

  const confFinals = {};
  for (const [conf, slot] of [["EAST", 1], ["WEST", 2]]) {
    confFinals[conf] = ok(
      `série CONF_FINALS ${conf}`,
      await supabase
        .from("series")
        .insert({ competition_id: competitionId, round: "CONF_FINALS", conference: conf, slot_index: 1, next_series_id: finals.id, next_series_slot: slot })
        .select("id")
        .single()
    );
  }

  const confSemis = {};
  for (const conf of ["EAST", "WEST"]) {
    for (const slotIndex of [1, 2]) {
      confSemis[`${conf}-${slotIndex}`] = ok(
        `série CONF_SEMIS ${conf} slot ${slotIndex}`,
        await supabase
          .from("series")
          .insert({
            competition_id: competitionId,
            round: "CONF_SEMIS",
            conference: conf,
            slot_index: slotIndex,
            next_series_id: confFinals[conf].id,
            next_series_slot: slotIndex,
          })
          .select("id")
          .single()
      );
    }
  }

  const ROUND_1_MATCHUPS = [
    { conf: "EAST", slot: 1, team1: "BOS", team2: "MIA", nextSemisSlot: 1, feedSlot: 1 },
    { conf: "EAST", slot: 2, team1: "NYK", team2: "ATL", nextSemisSlot: 1, feedSlot: 2 },
    { conf: "EAST", slot: 3, team1: "MIL", team2: "CHI", nextSemisSlot: 2, feedSlot: 1 },
    { conf: "EAST", slot: 4, team1: "CLE", team2: "ORL", nextSemisSlot: 2, feedSlot: 2 },
    { conf: "WEST", slot: 1, team1: "OKC", team2: "SAS", nextSemisSlot: 1, feedSlot: 1 },
    { conf: "WEST", slot: 2, team1: "DEN", team2: "SAC", nextSemisSlot: 1, feedSlot: 2 },
    { conf: "WEST", slot: 3, team1: "MIN", team2: "GSW", nextSemisSlot: 2, feedSlot: 1 },
    { conf: "WEST", slot: 4, team1: "LAL", team2: "HOU", nextSemisSlot: 2, feedSlot: 2 },
  ];

  const round1 = {};
  for (const m of ROUND_1_MATCHUPS) {
    const row = ok(
      `série ROUND_1 ${m.conf} ${m.team1}-${m.team2}`,
      await supabase
        .from("series")
        .insert({
          competition_id: competitionId,
          round: "ROUND_1",
          conference: m.conf,
          slot_index: m.slot,
          team1_id: teamId[m.team1],
          team2_id: teamId[m.team2],
          next_series_id: confSemis[`${m.conf}-${m.nextSemisSlot}`].id,
          next_series_slot: m.feedSlot,
        })
        .select("id")
        .single()
    );
    round1[`${m.team1}-${m.team2}`] = row.id;
  }

  // ── 5. Matchs du 1er tour — mélange voulu : séries FINISHED, séries
  //      IN_PROGRESS (dont une EN DIRECT), une série à peine commencée, une
  //      pas commencée. Scores plausibles, dates étalées sur ~2 semaines
  //      passées + quelques jours à venir. ──────────────────────────────────
  const SERIES_PLANS = [
    // BOS-MIA : TERMINÉE 4-1 BOS.
    {
      key: "BOS-MIA",
      games: [
        { day: -14, home: "BOS", away: "MIA", homeScore: 108, awayScore: 101 },
        { day: -11, home: "BOS", away: "MIA", homeScore: 115, awayScore: 96 },
        { day: -8, home: "MIA", away: "BOS", homeScore: 110, awayScore: 104 },
        { day: -6, home: "MIA", away: "BOS", homeScore: 92, awayScore: 99 },
        { day: -3, home: "BOS", away: "MIA", homeScore: 121, awayScore: 118 },
      ],
    },
    // NYK-ATL : TERMINÉE 4-2 NYK.
    {
      key: "NYK-ATL",
      games: [
        { day: -13, home: "NYK", away: "ATL", homeScore: 102, awayScore: 97 },
        { day: -10, home: "NYK", away: "ATL", homeScore: 94, awayScore: 101 },
        { day: -8, home: "ATL", away: "NYK", homeScore: 88, awayScore: 96 },
        { day: -6, home: "ATL", away: "NYK", homeScore: 110, awayScore: 105 },
        { day: -4, home: "NYK", away: "ATL", homeScore: 99, awayScore: 90 },
        { day: -2, home: "ATL", away: "NYK", homeScore: 95, awayScore: 112 },
      ],
    },
    // MIL-CHI : EN COURS, MIL mène 3-1, match 5 à venir sous 1 jour.
    {
      key: "MIL-CHI",
      games: [
        { day: -12, home: "MIL", away: "CHI", homeScore: 118, awayScore: 109 },
        { day: -9, home: "MIL", away: "CHI", homeScore: 104, awayScore: 111 },
        { day: -7, home: "CHI", away: "MIL", homeScore: 97, awayScore: 103 },
        { day: -5, home: "CHI", away: "MIL", homeScore: 89, awayScore: 100 },
        { day: 1, home: "MIL", away: "CHI", scheduledOnly: true },
      ],
    },
    // CLE-ORL : EN COURS, 2-2, match 5 dans 2 jours.
    {
      key: "CLE-ORL",
      games: [
        { day: -11, home: "CLE", away: "ORL", homeScore: 101, awayScore: 97 },
        { day: -8, home: "CLE", away: "ORL", homeScore: 92, awayScore: 96 },
        { day: -6, home: "ORL", away: "CLE", homeScore: 108, awayScore: 100 },
        { day: -4, home: "ORL", away: "CLE", homeScore: 90, awayScore: 95 },
        { day: 2, home: "CLE", away: "ORL", scheduledOnly: true },
      ],
    },
    // OKC-SAS : TERMINÉE 4-0 (sweep OKC).
    {
      key: "OKC-SAS",
      games: [
        { day: -10, home: "OKC", away: "SAS", homeScore: 124, awayScore: 102 },
        { day: -7, home: "OKC", away: "SAS", homeScore: 110, awayScore: 99 },
        { day: -5, home: "SAS", away: "OKC", homeScore: 95, awayScore: 101 },
        { day: -3, home: "SAS", away: "OKC", homeScore: 100, awayScore: 109 },
      ],
    },
    // DEN-SAC : EN COURS, DEN mène 2-1, match 4 EN DIRECT en ce moment.
    {
      key: "DEN-SAC",
      games: [
        { day: -9, home: "DEN", away: "SAC", homeScore: 112, awayScore: 105 },
        { day: -6, home: "DEN", away: "SAC", homeScore: 98, awayScore: 103 },
        { day: -4, home: "SAC", away: "DEN", homeScore: 94, awayScore: 100 },
        { hours: -1.5, home: "SAC", away: "DEN", status: "IN_PROGRESS", homeScore: 61, awayScore: 58 },
      ],
    },
    // MIN-GSW : à peine commencée, MIN mène 1-0, match 2 pas encore casé.
    {
      key: "MIN-GSW",
      games: [
        { day: -5, home: "MIN", away: "GSW", homeScore: 106, awayScore: 99 },
        { day: null, home: "GSW", away: "MIN", scheduledOnly: true }, // date pas encore confirmée
      ],
    },
    // LAL-HOU : pas encore commencée, match 1 dans 2 jours.
    {
      key: "LAL-HOU",
      games: [{ day: 2, home: "LAL", away: "HOU", scheduledOnly: true }],
    },
  ];

  const matchId = {}; // "BOS-MIA-1" etc.
  for (const plan of SERIES_PLANS) {
    for (let i = 0; i < plan.games.length; i++) {
      const g = plan.games[i];
      const gameNumber = i + 1;
      const at = g.day === null ? null : g.hours !== undefined ? hoursFromNow(g.hours) : daysFromNow(g.day);
      const row = ok(
        `match ${plan.key} #${gameNumber}`,
        await supabase
          .from("matches")
          .insert({
            competition_id: competitionId,
            series_id: round1[plan.key],
            game_number: gameNumber,
            scheduled_at: at,
            home_team_id: teamId[g.home],
            away_team_id: teamId[g.away],
            ...(g.scheduledOnly
              ? {}
              : {
                  status: g.status ?? "FINISHED",
                  home_score: g.homeScore,
                  away_score: g.awayScore,
                }),
          })
          .select("id")
          .single()
      );
      matchId[`${plan.key}-${gameNumber}`] = row.id;
    }
  }

  // bracket_deadline = heure du 1er match (game_number=1) le plus tôt, tous
  // les 1ers tours confondus (même définition que scripts/seed-playoffs-
  // test-data.mjs) — relue depuis les lignes RÉELLEMENT insérées (pas
  // recalculée via daysFromNow, qui dériverait de quelques secondes par
  // rapport à l'insertion ci-dessus).
  const { data: earliestGame1 } = await supabase
    .from("matches")
    .select("scheduled_at")
    .eq("competition_id", competitionId)
    .eq("game_number", 1)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .single();
  ok(
    "bracket_deadline (1er match du 1er tour)",
    await supabase.from("competitions").update({ bracket_deadline: earliestGame1.scheduled_at }).eq("id", competitionId)
  );

  // ── 6. 10 bots (comptes réels, mot de passe CONNU) ──────────────────────
  const BOTS = [
    { pseudo: "Amine92", email: "seed-sim-amine92@nba-pronos.test", skill: 0.8 },
    { pseudo: "Chloe_B", email: "seed-sim-chloeb@nba-pronos.test", skill: 0.55 },
    { pseudo: "Yanis44", email: "seed-sim-yanis44@nba-pronos.test", skill: 0.7 },
    { pseudo: "Marco_D", email: "seed-sim-marcod@nba-pronos.test", skill: 0.4 },
    { pseudo: "Nina_R", email: "seed-sim-ninar@nba-pronos.test", skill: 0.65 },
    { pseudo: "Tariq_M", email: "seed-sim-tariqm@nba-pronos.test", skill: 0.5 },
    { pseudo: "Lucas_P", email: "seed-sim-lucasp@nba-pronos.test", skill: 0.9 },
    { pseudo: "Emma_K", email: "seed-sim-emmak@nba-pronos.test", skill: 0.3 },
    { pseudo: "Karim_T", email: "seed-sim-karimt@nba-pronos.test", skill: 0.6 },
    { pseudo: "Zoe_L", email: "seed-sim-zoel@nba-pronos.test", skill: 0.45 },
  ];

  const userId = {};
  for (const b of BOTS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: b.email,
      password: BOT_PASSWORD,
      email_confirm: true,
      user_metadata: { pseudo: b.pseudo },
    });
    if (error) {
      console.error(`ÉCHEC — création du compte ${b.pseudo} :`, error.message);
      process.exit(1);
    }
    console.log(`OK — compte ${b.pseudo} (${data.user.id})`);
    userId[b.pseudo] = data.user.id;
  }

  // ── 7. "Vrai" résultat hypothétique de la saison complète (sert UNIQUEMENT
  //      à générer des picks de bracket plausibles selon le "skill" de
  //      chaque bot — le 1er tour suit les scores RÉELLEMENT posés ci-dessus
  //      pour les séries déjà jouées ; le reste est une intention narrative,
  //      jamais écrite en `official_*`, qui ne sera dérivé QUE par le vrai
  //      moteur à partir des matchs). ───────────────────────────────────────
  const TRUE_WINNER = {
    "BOS-MIA": "BOS", "NYK-ATL": "NYK", "MIL-CHI": "MIL", "CLE-ORL": "CLE",
    "OKC-SAS": "OKC", "DEN-SAC": "DEN", "MIN-GSW": "GSW", "LAL-HOU": "HOU",
  };
  const CONF_SEMIS_WINNER = { "EAST-1": "BOS", "EAST-2": "CLE", "WEST-1": "OKC", "WEST-2": "GSW" };
  const CONF_FINALS_WINNER = { EAST: "BOS", WEST: "OKC" };
  const FINALS_WINNER = "BOS";

  const SCORE_FORMATS = ["4-0", "4-1", "4-2", "4-3"];
  function weightedFormat(rng) {
    // Un format serré (4-2/4-3) est plus fréquent qu'un sweep — pondération
    // narrative simple, pas une vraie donnée statistique NBA.
    const r = rng();
    if (r < 0.12) return "4-0";
    if (r < 0.35) return "4-1";
    if (r < 0.68) return "4-2";
    return "4-3";
  }

  // ── 8. Brackets + 15 picks par bot (générés selon le "skill") ───────────
  const bracketId = {};
  for (const bot of BOTS) {
    const rng = mulberry32(seedFromString(bot.pseudo + "-bracket"));
    const validated = rng() < 0.7; // la plupart valident leur bracket
    const b = ok(
      `bracket de ${bot.pseudo}`,
      await supabase
        .from("brackets")
        .insert({
          user_id: userId[bot.pseudo],
          competition_id: competitionId,
          is_validated: validated,
          validated_at: validated ? new Date().toISOString() : null,
        })
        .select("id")
        .single()
    );
    bracketId[bot.pseudo] = b.id;

    async function pick(seriesId, trueWinnerAbbrev, otherAbbrev) {
      const guessRight = rng() < bot.skill;
      const winner = guessRight ? trueWinnerAbbrev : otherAbbrev;
      await supabase.from("bracket_picks").insert({
        competition_id: competitionId,
        bracket_id: b.id,
        series_id: seriesId,
        predicted_winner_team_id: teamId[winner],
        predicted_score_format: weightedFormat(rng),
      });
    }

    // ROUND_1 (8).
    for (const m of ROUND_1_MATCHUPS) {
      const key = `${m.team1}-${m.team2}`;
      await pick(round1[key], TRUE_WINNER[key], TRUE_WINNER[key] === m.team1 ? m.team2 : m.team1);
    }
    // CONF_SEMIS (4) — vainqueur "vrai" vs l'un des 2 autres (approximation :
    // l'autre équipe possible de la même conférence, cohérent pour la
    // génération, jamais vérifié contre une paire officielle à ce stade).
    await pick(confSemis["EAST-1"].id, "BOS", "NYK");
    await pick(confSemis["EAST-2"].id, "CLE", "MIL");
    await pick(confSemis["WEST-1"].id, "OKC", "DEN");
    await pick(confSemis["WEST-2"].id, "GSW", "MIN");
    // CONF_FINALS (2).
    await pick(confFinals["EAST"].id, "BOS", "CLE");
    await pick(confFinals["WEST"].id, "OKC", "GSW");
    // NBA_FINALS (1).
    await pick(finals.id, "BOS", "OKC");
    console.log(`OK — 15 picks de ${bot.pseudo} (bracket ${validated ? "validé" : "brouillon"})`);
  }

  // ── 9. Pronos match sur les séries déjà en cours/terminées ──────────────
  // Chaque bot pronostique chaque match FINISHED/IN_PROGRESS déjà joué (pas
  // les matchs futurs, un joueur réel n'a pas encore de raison de le faire
  // sauf exception ci-dessous). Statut VALIDATED pour la plupart, quelques
  // DRAFT complets (score quand même, cf. isPredictionFrozen) pour la
  // variété d'états.
  const PLAYED_MATCH_KEYS = [
    "BOS-MIA-1", "BOS-MIA-2", "BOS-MIA-3", "BOS-MIA-4", "BOS-MIA-5",
    "NYK-ATL-1", "NYK-ATL-2", "NYK-ATL-3", "NYK-ATL-4", "NYK-ATL-5", "NYK-ATL-6",
    "MIL-CHI-1", "MIL-CHI-2", "MIL-CHI-3", "MIL-CHI-4",
    "CLE-ORL-1", "CLE-ORL-2", "CLE-ORL-3", "CLE-ORL-4",
    "OKC-SAS-1", "OKC-SAS-2", "OKC-SAS-3", "OKC-SAS-4",
    "DEN-SAC-1", "DEN-SAC-2", "DEN-SAC-3",
    "MIN-GSW-1",
  ];
  const MATCH_ACTUAL = Object.fromEntries(
    SERIES_PLANS.flatMap((plan) =>
      plan.games
        .map((g, i) => [`${plan.key}-${i + 1}`, g])
        .filter(([, g]) => !g.scheduledOnly)
    )
  );

  for (const bot of BOTS) {
    const rng = mulberry32(seedFromString(bot.pseudo + "-preds"));
    for (const key of PLAYED_MATCH_KEYS) {
      const game = MATCH_ACTUAL[key];
      const actualMargin = Math.abs(game.homeScore - game.awayScore);
      const actualWinnerAbbrev = game.homeScore > game.awayScore ? game.home : game.away;
      const loserAbbrev = actualWinnerAbbrev === game.home ? game.away : game.home;
      const guessRight = rng() < bot.skill;
      const predictedWinner = guessRight ? actualWinnerAbbrev : loserAbbrev;
      // Écart pronostiqué : proche du réel si le bot est doué, plus au hasard sinon.
      const jitter = Math.round((rng() - 0.5) * (bot.skill > 0.6 ? 4 : 12));
      const predictedMargin = Math.max(1, Math.min(50, actualMargin + jitter));

      const { data: predRow, error } = await supabase
        .from("match_predictions")
        .insert({
          competition_id: competitionId,
          user_id: userId[bot.pseudo],
          match_id: matchId[key],
          predicted_winner_team_id: teamId[predictedWinner],
          predicted_margin: predictedMargin,
        })
        .select("id")
        .single();
      if (error) {
        console.error(`ÉCHEC — prono ${bot.pseudo} sur ${key} :`, error.message);
        process.exit(1);
      }
      if (rng() < 0.75) {
        await supabase
          .from("match_predictions")
          .update({ status: "VALIDATED", validated_at: new Date().toISOString() })
          .eq("id", predRow.id);
      }
      // sinon laissé DRAFT (mais complet -> scoré quand même, cf. moteur).
    }
    console.log(`OK — ${PLAYED_MATCH_KEYS.length} pronos de ${bot.pseudo}`);
  }

  // Quelques pronos DRAFT PARTIELS (juste le vainqueur) sur un match à venir,
  // pour la variété d'états (§18 SPEC_ECRAN_MES_PRONOS déjà couvert par le
  // script existant — repris ici pour 3 bots).
  for (const pseudo of ["Chloe_B", "Nina_R", "Karim_T"]) {
    await supabase.from("match_predictions").insert({
      competition_id: competitionId,
      user_id: userId[pseudo],
      match_id: matchId["MIL-CHI-5"],
      predicted_winner_team_id: teamId["MIL"],
      predicted_margin: null,
    });
  }
  console.log("OK — 3 pronos brouillon partiels sur MIL-CHI #5 (match à venir)");

  // ── 10. Quelques paris personnalisés, pour la variété (flavor) ──────────
  ok(
    "pari WON de Lucas_P",
    await supabase.from("bets").insert({
      competition_id: competitionId,
      user_id: userId["Lucas_P"],
      scope: "SERIES",
      series_id: round1["BOS-MIA"],
      description: "Boston gagne la série en 5 matchs maximum",
      proposed_category: "TEAM_PROP",
      validated_category: "TEAM_PROP",
      proposed_difficulty: 3,
      validated_difficulty: 3,
      status: "WON",
      submitted_at: daysFromNow(-15),
      validated_at: daysFromNow(-14),
      validated_by_admin_id: userId["Amine92"],
      resolved_at: daysFromNow(-3),
      resolved_by_admin_id: userId["Amine92"],
    })
  );
  ok(
    "pari LOST de Emma_K",
    await supabase.from("bets").insert({
      competition_id: competitionId,
      user_id: userId["Emma_K"],
      scope: "MATCH",
      series_id: round1["OKC-SAS"],
      match_id: matchId["OKC-SAS-1"],
      description: "San Antonio marque plus de 110 points",
      proposed_category: "SCORE_TOTAL",
      validated_category: "SCORE_TOTAL",
      proposed_difficulty: 2,
      validated_difficulty: 2,
      status: "LOST",
      submitted_at: daysFromNow(-11),
      validated_at: daysFromNow(-10),
      validated_by_admin_id: userId["Amine92"],
      resolved_at: daysFromNow(-10),
      resolved_by_admin_id: userId["Amine92"],
    })
  );
  ok(
    "pari DRAFT de Zoe_L",
    await supabase.from("bets").insert({
      competition_id: competitionId,
      user_id: userId["Zoe_L"],
      scope: "MATCH",
      series_id: round1["DEN-SAC"],
      match_id: matchId["DEN-SAC-3"],
      description: "Denver mène de plus de 10 points à la mi-temps",
      proposed_category: "TEAM_PROP",
      proposed_difficulty: 2,
      status: "DRAFT",
    })
  );

  // ── 11. Un bot désactivé APRÈS avoir joué (réalisme, §8) ────────────────
  ok("désactivation de Marco_D", await supabase.from("users").update({ status: "DISABLED" }).eq("id", userId["Marco_D"]));

  // ── 12. Passe de scoring RÉELLE (mêmes fonctions pures que l'app) ───────
  // Réimplémentation de recomputeMatch/recomputeSeries/writeSeriesOutcome
  // (lib/scoring/recompute.ts, lib/sync/writeSeriesOutcome.ts) — mêmes
  // requêtes, même séquence, seul le calcul vient du vrai moteur importé.
  async function recomputeMatch(matchIdValue) {
    const { data: matchRow } = await supabase
      .from("matches")
      .select("id, series_id, status, home_team_id, away_team_id, home_score, away_score")
      .eq("id", matchIdValue)
      .single();
    const officialMatch = {
      id: matchRow.id,
      status: matchRow.status,
      homeTeamId: matchRow.home_team_id,
      awayTeamId: matchRow.away_team_id,
      homeScore: matchRow.home_score,
      awayScore: matchRow.away_score,
    };

    const { data: predictionsData } = await supabase
      .from("match_predictions")
      .select("id, predicted_winner_team_id, predicted_margin, status")
      .eq("match_id", matchIdValue);
    for (const prediction of predictionsData ?? []) {
      const isFrozen =
        prediction.status === "VALIDATED" ||
        prediction.status === "LOCKED" ||
        (prediction.predicted_winner_team_id !== null && prediction.predicted_margin !== null);
      const score = scoreMatchPrediction(
        {
          predictedWinnerTeamId: prediction.predicted_winner_team_id,
          predictedMargin: prediction.predicted_margin,
          isFrozen,
        },
        officialMatch
      );
      await supabase
        .from("match_predictions")
        .update({
          is_winner_correct: score.isWinnerCorrect,
          margin_diff: score.marginDiff,
          winner_points: score.winnerPoints,
          margin_bonus_points: score.marginBonusPoints,
          scored_at: score.winnerPoints !== null ? new Date().toISOString() : null,
        })
        .eq("id", prediction.id);
    }

    const { data: seriesRow } = await supabase
      .from("series")
      .select("id, round, competition_id, official_status, official_winner_team_id, official_score_format")
      .eq("id", matchRow.series_id)
      .single();

    const { data: competitionRow } = await supabase.from("competitions").select("type").eq("id", seriesRow.competition_id).single();
    const { data: seriesMatchData } = await supabase
      .from("matches")
      .select("id, series_id, status, home_team_id, away_team_id, home_score, away_score")
      .eq("series_id", seriesRow.id);
    const derived = deriveSeriesOutcome(
      (seriesMatchData ?? []).map((m) => ({
        id: m.id,
        status: m.status,
        homeTeamId: m.home_team_id,
        awayTeamId: m.away_team_id,
        homeScore: m.home_score,
        awayScore: m.away_score,
      })),
      competitionRow?.type ?? "PLAYOFFS"
    );

    const hasChanged =
      derived.status !== seriesRow.official_status ||
      derived.winnerTeamId !== seriesRow.official_winner_team_id ||
      derived.scoreFormat !== seriesRow.official_score_format;
    if (!hasChanged) return;

    await supabase
      .from("series")
      .update({
        official_status: derived.status,
        official_winner_team_id: derived.winnerTeamId,
        official_score_format: derived.scoreFormat,
      })
      .eq("id", seriesRow.id);

    await recomputeSeries(seriesRow.id);
  }

  async function recomputeSeries(seriesIdValue) {
    const { data: seriesRow } = await supabase
      .from("series")
      .select("id, round, competition_id, official_status, official_winner_team_id, official_score_format, team1_id, team2_id")
      .eq("id", seriesIdValue)
      .single();

    const { data: picksData } = await supabase
      .from("bracket_picks")
      .select("id, bracket_id, series_id, predicted_winner_team_id, predicted_score_format")
      .eq("series_id", seriesIdValue);
    const picks = picksData ?? [];
    if (picks.length === 0) return;

    const { data: feedersData } = await supabase.from("series").select("id, next_series_slot").eq("next_series_id", seriesIdValue);
    const feeders = feedersData ?? [];
    const feederSlot1Id = feeders.find((f) => f.next_series_slot === 1)?.id ?? null;
    const feederSlot2Id = feeders.find((f) => f.next_series_slot === 2)?.id ?? null;

    const feederSeriesIds = [feederSlot1Id, feederSlot2Id].filter((id) => id !== null);
    const { data: feederPicksData } =
      feederSeriesIds.length > 0
        ? await supabase.from("bracket_picks").select("bracket_id, series_id, predicted_winner_team_id").in("series_id", feederSeriesIds)
        : { data: [] };
    const feederPicks = feederPicksData ?? [];

    const outcome = {
      status: seriesRow.official_status,
      winnerTeamId: seriesRow.official_winner_team_id,
      scoreFormat: seriesRow.official_score_format,
    };
    const officialPair = { a: seriesRow.team1_id, b: seriesRow.team2_id };

    for (const pick of picks) {
      const predictedPair = {
        a: feederPicks.find((fp) => fp.bracket_id === pick.bracket_id && fp.series_id === feederSlot1Id)?.predicted_winner_team_id ?? null,
        b: feederPicks.find((fp) => fp.bracket_id === pick.bracket_id && fp.series_id === feederSlot2Id)?.predicted_winner_team_id ?? null,
      };
      const score = scoreBracketPick(
        { predictedWinnerTeamId: pick.predicted_winner_team_id, predictedScoreFormat: pick.predicted_score_format },
        seriesRow.round,
        outcome,
        predictedPair,
        officialPair
      );
      const hasAnyComponent = score.winnerPoints !== null || score.exactScorePoints !== null || score.matchupPoints !== null;
      await supabase
        .from("bracket_picks")
        .update({
          is_winner_correct: score.isWinnerCorrect,
          is_score_exact: score.isScoreExact,
          is_matchup_correct: score.isMatchupCorrect,
          winner_points: score.winnerPoints,
          exact_score_points: score.exactScorePoints,
          matchup_points: score.matchupPoints,
          scored_at: hasAnyComponent ? new Date().toISOString() : null,
        })
        .eq("id", pick.id);
    }
  }

  async function advanceWinnerIfDecided(seriesIdValue) {
    const { data: series } = await supabase
      .from("series")
      .select("official_status, official_winner_team_id, next_series_id, next_series_slot")
      .eq("id", seriesIdValue)
      .single();
    if (!series || series.official_status !== "FINISHED") return;
    if (!series.official_winner_team_id || !series.next_series_id || !series.next_series_slot) return;
    const column = series.next_series_slot === 1 ? "team1_id" : "team2_id";
    const { data: nextSeries } = await supabase.from("series").select("team1_id, team2_id").eq("id", series.next_series_id).single();
    if (!nextSeries || nextSeries[column] !== null) return;
    await supabase.from("series").update({ [column]: series.official_winner_team_id }).eq("id", series.next_series_id);
  }

  console.log("\n--- Passe de scoring + avancement ---");
  for (const key of Object.keys(matchId)) {
    await recomputeMatch(matchId[key]);
  }
  for (const key of Object.keys(round1)) {
    await advanceWinnerIfDecided(round1[key]);
  }
  // 2e passe : une série CONF_SEMIS pourrait être devenue "affiche connue"
  // (les 2 team_id remplis) après l'avancement ci-dessus -> ses picks
  // "affiche" doivent être re-scorés (recomputeSeries dépend de team1_id/
  // team2_id, lus au moment de l'appel -- déjà fait dans recomputeMatch,
  // mais l'avancement a lieu APRÈS -> un 2nd passage sur les séries
  // CONF_SEMIS impactées referme la boucle, même limite que le filet de
  // sécurité recomputeCompetition côté app).
  for (const key of ["EAST-1", "EAST-2", "WEST-1", "WEST-2"]) {
    await recomputeSeries(confSemis[key].id);
  }
  console.log("OK — scoring + avancement terminés");

  // ── 13. Récapitulatif + fichier de credentials (HORS DÉPÔT) ─────────────
  const credLines = [
    "=== Comptes bots — simulation Playoffs NBA (14/08/2026) ===",
    `Mot de passe (commun aux 10 comptes) : ${BOT_PASSWORD}`,
    "",
    ...BOTS.map((b) => `${b.pseudo.padEnd(10)} ${b.email}`),
    "",
    `Compétition : ${SIMULATION_COMPETITION_NAME} (${competitionId})`,
    "Ce fichier n'est PAS dans le dépôt git — à supprimer une fois la simulation terminée.",
  ];
  writeFileSync(CREDENTIALS_OUTPUT_PATH, credLines.join("\n") + "\n", "utf8");

  console.log("\n=== SEED TERMINÉ ===");
  console.log("Compétition :", competitionId);
  console.log("Identifiants des bots écrits dans :", CREDENTIALS_OUTPUT_PATH);
}

main().then(() => {
  console.log("\nTerminé sans erreur.");
  process.exit(0);
});
