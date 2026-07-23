#!/usr/bin/env node
// ============================================================================
// SEED — Playoffs NBA (jeu de données de TEST)
// ============================================================================
// Fichier  : scripts/seed-playoffs-test-data.mjs
// Usage    : node --env-file=.env.local scripts/seed-playoffs-test-data.mjs
// Nature   : script HORS supabase/migrations/ (décision validée en phase 1 du
//            prompt "données de test", 23/07/2026). Deux raisons :
//              (a) la création des comptes de test passe par l'API Admin
//                  Supabase (auth.admin.createUser), non exprimable en SQL
//                  portable — public.users est alimentée par un TRIGGER
//                  depuis auth.users (École A), pas par un INSERT direct ;
//              (b) ce dépôt n'a qu'UN SEUL projet Supabase lié (db push
//                  cible potentiellement la future prod) — ce jeu de
//                  données jetable ne doit pas vivre dans l'historique de
//                  migrations rejouable.
// Portée   : 30 équipes NBA (référentiel), 1 compétition PLAYOFFS ACTIVE,
//            bracket complet 15 séries (8 réelles au 1er tour + squelette
//            des tours suivants, non résolu), 9 matchs de 1er tour, 7
//            comptes de test (dont 1 admin, 1 désactivé, 1 qui n'a jamais
//            joué), pronos/brackets/paris dans des états produit variés.
//
// RÈGLE SUIVIE (à ne pas transgresser en le modifiant) : aucun résultat,
// aucun score n'est écrit ici. points_awarded, winner_points,
// margin_bonus_points, is_winner_correct, margin_diff, scored_at,
// official_winner_team_id, statut FINISHED : tout ça est la SORTIE du
// moteur de scoring (T5) et de la synchro (T4), qui n'existent pas encore
// dans le code. Toutes les séries restent SCHEDULED, tous les matchs
// SCHEDULED, aucun résultat officiel nulle part — c'est un instantané
// plausible de tout DÉBUT de tournoi, pas une simulation de son issue.
//
// SÉCURITÉ : utilise service_role (comme le fera plus tard la synchro T4),
// qui CONTOURNE la RLS par conception. La RLS reste ACTIVE sur toutes les
// tables ; elle n'est désactivée nulle part par ce script.
//
// ATTENTION : ce script n'est PAS transactionnel — chaque insertion est un
// appel réseau séparé (PostgREST), pas un bloc SQL unique. Une erreur en
// cours de route laisse un état partiel en base ; dans ce cas, nettoyer
// avant de relancer (le script n'est pas idempotent, garde en tête de
// fichier).
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/seed-playoffs-test-data.mjs)"
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Échoue bruyamment plutôt que de continuer sur une erreur silencieuse : un
// seed à moitié inséré est pire qu'un seed qui s'arrête net.
function ok(label, { data, error }) {
  if (error) {
    console.error(`ÉCHEC — ${label} :`, error.message);
    process.exit(1);
  }
  console.log(`OK — ${label}`);
  return data;
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function main() {
  // ── 0. Garde anti double-exécution ────────────────────────────────────
  const { data: existing } = await supabase
    .from("competitions")
    .select("id")
    .eq("name", "Playoffs NBA (test)")
    .maybeSingle();
  if (existing) {
    throw new Error(
      `Une compétition 'Playoffs NBA (test)' existe déjà (id ${existing.id}). ` +
        "Ce script n'est pas idempotent — nettoyer avant de relancer."
    );
  }

  // ── 1. Équipes NBA (référentiel complet, D6) ────────────────────────────
  const TEAMS = [
    // EAST — Atlantic
    { name: "Boston Celtics", abbreviation: "BOS", conference: "EAST" },
    { name: "Brooklyn Nets", abbreviation: "BKN", conference: "EAST" },
    { name: "New York Knicks", abbreviation: "NYK", conference: "EAST" },
    { name: "Philadelphia 76ers", abbreviation: "PHI", conference: "EAST" },
    { name: "Toronto Raptors", abbreviation: "TOR", conference: "EAST" },
    // EAST — Central
    { name: "Chicago Bulls", abbreviation: "CHI", conference: "EAST" },
    { name: "Cleveland Cavaliers", abbreviation: "CLE", conference: "EAST" },
    { name: "Detroit Pistons", abbreviation: "DET", conference: "EAST" },
    { name: "Indiana Pacers", abbreviation: "IND", conference: "EAST" },
    { name: "Milwaukee Bucks", abbreviation: "MIL", conference: "EAST" },
    // EAST — Southeast
    { name: "Atlanta Hawks", abbreviation: "ATL", conference: "EAST" },
    { name: "Charlotte Hornets", abbreviation: "CHA", conference: "EAST" },
    { name: "Miami Heat", abbreviation: "MIA", conference: "EAST" },
    { name: "Orlando Magic", abbreviation: "ORL", conference: "EAST" },
    { name: "Washington Wizards", abbreviation: "WAS", conference: "EAST" },
    // WEST — Northwest
    { name: "Denver Nuggets", abbreviation: "DEN", conference: "WEST" },
    { name: "Minnesota Timberwolves", abbreviation: "MIN", conference: "WEST" },
    { name: "Oklahoma City Thunder", abbreviation: "OKC", conference: "WEST" },
    { name: "Portland Trail Blazers", abbreviation: "POR", conference: "WEST" },
    { name: "Utah Jazz", abbreviation: "UTA", conference: "WEST" },
    // WEST — Pacific
    { name: "Golden State Warriors", abbreviation: "GSW", conference: "WEST" },
    { name: "LA Clippers", abbreviation: "LAC", conference: "WEST" },
    { name: "Los Angeles Lakers", abbreviation: "LAL", conference: "WEST" },
    { name: "Phoenix Suns", abbreviation: "PHX", conference: "WEST" },
    { name: "Sacramento Kings", abbreviation: "SAC", conference: "WEST" },
    // WEST — Southwest
    { name: "Dallas Mavericks", abbreviation: "DAL", conference: "WEST" },
    { name: "Houston Rockets", abbreviation: "HOU", conference: "WEST" },
    { name: "Memphis Grizzlies", abbreviation: "MEM", conference: "WEST" },
    { name: "New Orleans Pelicans", abbreviation: "NOP", conference: "WEST" },
    { name: "San Antonio Spurs", abbreviation: "SAS", conference: "WEST" },
  ];

  const teamsInserted = ok(
    "30 équipes NBA",
    await supabase.from("teams").insert(TEAMS).select("id, abbreviation")
  );
  const teamId = Object.fromEntries(teamsInserted.map((t) => [t.abbreviation, t.id]));

  // ── 2. Compétition ACTIVE + code de rejoin ──────────────────────────────
  // bracket_deadline = heure du 1er match du tour feuille (T6b §2) = Match 1
  // de la série BOS-MIA, dans 18h à partir de maintenant.
  const E1_GAME1_AT = hoursFromNow(18);

  const competition = ok(
    "compétition Playoffs (test)",
    await supabase
      .from("competitions")
      .insert({
        name: "Playoffs NBA (test)",
        type: "PLAYOFFS",
        status: "ACTIVE",
        bracket_deadline: E1_GAME1_AT,
      })
      .select("id")
      .single()
  );
  const competitionId = competition.id;

  const joinCode = randomUUID().slice(0, 8).toUpperCase();
  ok(
    "code de compétition",
    await supabase
      .from("competition_secrets")
      .insert({ competition_id: competitionId, join_code: joinCode })
  );

  // ── 3. Squelette du bracket (15 séries) ─────────────────────────────────
  // Ordre d'insertion FORCÉ par next_series_id (FK vers une série qui doit
  // déjà exister en base) : on part de la finale et on redescend jusqu'au
  // 1er tour.

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
        .insert({
          competition_id: competitionId,
          round: "CONF_FINALS",
          conference: conf,
          slot_index: 1,
          next_series_id: finals.id,
          next_series_slot: slot,
        })
        .select("id")
        .single()
    );
  }

  const confSemis = {}; // clé "EAST-1" / "EAST-2" / "WEST-1" / "WEST-2"
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
            next_series_slot: slotIndex, // slot1→slot1 des conf. finales, slot2→slot2
          })
          .select("id")
          .single()
      );
    }
  }

  // 1er tour : 4 séries par conférence, appariées 2 par 2 vers CONF_SEMIS
  // (slot1+slot2 → CONF_SEMIS slot1 ; slot3+slot4 → CONF_SEMIS slot2).
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

  const round1 = {}; // clé "BOS-MIA" etc. → id de la série
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

  // ── 4. Matchs du 1er tour ────────────────────────────────────────────────
  // Étalés : plusieurs sous 3 jours (fenêtre de l'écran Matchs), certains
  // au-delà, un match 2 à date encore inconnue (scheduled_at NULL — cas réel
  // du match 2 d'une série non encore calé tant que le match 1 n'est pas joué).
  const MATCHES = [
    { key: "BOS-MIA", game: 1, at: E1_GAME1_AT, home: "BOS", away: "MIA" }, // 18h — sous 3j
    { key: "BOS-MIA", game: 2, at: null, home: "MIA", away: "BOS" }, // date pas encore confirmée
    { key: "NYK-ATL", game: 1, at: hoursFromNow(30), home: "NYK", away: "ATL" }, // sous 3j
    { key: "MIL-CHI", game: 1, at: hoursFromNow(52), home: "MIL", away: "CHI" }, // ~2j4h, sous 3j
    { key: "CLE-ORL", game: 1, at: hoursFromNow(92), home: "CLE", away: "ORL" }, // ~3j20h, AU-DELÀ de 3j
    { key: "OKC-SAS", game: 1, at: hoursFromNow(42), home: "OKC", away: "SAS" }, // sous 3j
    { key: "DEN-SAC", game: 1, at: hoursFromNow(120), home: "DEN", away: "SAC" }, // 5j, au-delà
    { key: "MIN-GSW", game: 1, at: hoursFromNow(144), home: "MIN", away: "GSW" }, // 6j, au-delà
    { key: "LAL-HOU", game: 1, at: hoursFromNow(26), home: "LAL", away: "HOU" }, // sous 3j
  ];

  const matchId = {}; // clé "BOS-MIA-1" etc. → id du match
  for (const m of MATCHES) {
    const row = ok(
      `match ${m.key} #${m.game}`,
      await supabase
        .from("matches")
        .insert({
          competition_id: competitionId,
          series_id: round1[m.key],
          game_number: m.game,
          scheduled_at: m.at,
          home_team_id: teamId[m.home],
          away_team_id: teamId[m.away],
        })
        .select("id")
        .single()
    );
    matchId[`${m.key}-${m.game}`] = row.id;
  }

  // ── 5. Joueurs de test (API Admin — seule voie propre, phase 1 §1.2.a) ──
  // email_confirm:true : compte utilisable immédiatement, sans dépendre du
  // réglage « Confirm email » du dashboard (phase 1 §1.2.b — non modifié ici).
  const PLAYERS = [
    { pseudo: "Amine92", email: "seed-amine92@nba-pronos.test" },
    { pseudo: "Chloe_B", email: "seed-chloeb@nba-pronos.test" },
    { pseudo: "Yanis44", email: "seed-yanis44@nba-pronos.test" },
    { pseudo: "Sofia_Admin", email: "seed-sofia@nba-pronos.test" },
    { pseudo: "Marco_D", email: "seed-marcod@nba-pronos.test" },
    { pseudo: "Nina_R", email: "seed-ninar@nba-pronos.test" },
    { pseudo: "Tariq_M", email: "seed-tariqm@nba-pronos.test" }, // jamais joué — vérifie l'absence au classement
  ];

  const userId = {};
  for (const p of PLAYERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: p.email,
      password: randomUUID(), // mot de passe jetable, jamais utilisé (comptes de test)
      email_confirm: true,
      user_metadata: { pseudo: p.pseudo },
    });
    if (error) {
      console.error(`ÉCHEC — création du compte ${p.pseudo} :`, error.message);
      process.exit(1);
    }
    console.log(`OK — compte ${p.pseudo} (${data.user.id})`);
    userId[p.pseudo] = data.user.id;
  }

  // Promotion admin (phase 1 §1.2.c) — service_role, auth.uid() NULL, la
  // migration #4 laisse passer sans garde en contexte système.
  ok(
    "promotion Sofia_Admin → ADMIN",
    await supabase.from("users").update({ role: "ADMIN" }).eq("id", userId["Sofia_Admin"])
  );

  // ── 6. Brackets ──────────────────────────────────────────────────────────
  async function createBracket(pseudo, { validated = false } = {}) {
    const row = ok(
      `bracket de ${pseudo}`,
      await supabase
        .from("brackets")
        .insert({
          user_id: userId[pseudo],
          competition_id: competitionId,
          is_validated: validated,
          validated_at: validated ? new Date().toISOString() : null,
        })
        .select("id")
        .single()
    );
    return row.id;
  }

  async function pick(bracketId, seriesId, teamAbbrev, format) {
    ok(
      `pick ${teamAbbrev} (${format})`,
      await supabase.from("bracket_picks").insert({
        competition_id: competitionId,
        bracket_id: bracketId,
        series_id: seriesId,
        predicted_winner_team_id: teamId[teamAbbrev],
        predicted_score_format: format,
      })
    );
  }

  // Amine92 : bracket avancé mais incomplet (11/15), cohérent avec SES
  // propres picks du 1er tour — la cascade est le pari du joueur, pas une
  // donnée dérivée de séries officiellement résolues (T6b §3.2 : la paire
  // amont d'un tour suivant est "la paire issue de la cascade des picks
  // amont" si les équipes officielles ne sont pas encore connues).
  {
    const b = await createBracket("Amine92");
    await pick(b, round1["BOS-MIA"], "BOS", "4-2");
    await pick(b, round1["NYK-ATL"], "NYK", "4-1");
    await pick(b, round1["MIL-CHI"], "MIL", "4-3");
    await pick(b, round1["CLE-ORL"], "CLE", "4-0");
    await pick(b, round1["OKC-SAS"], "OKC", "4-1");
    await pick(b, round1["DEN-SAC"], "DEN", "4-2");
    await pick(b, round1["MIN-GSW"], "MIN", "4-3");
    await pick(b, round1["LAL-HOU"], "LAL", "4-2");
    await pick(b, confSemis["EAST-1"].id, "BOS", "4-3"); // BOS vs NYK selon SES picks
    await pick(b, confSemis["EAST-2"].id, "CLE", "4-1"); // MIL vs CLE selon SES picks
    await pick(b, confFinals["EAST"].id, "BOS", "4-2"); // BOS vs CLE selon SES picks
    // WEST semis/finale + NBA_FINALS : laissés vides (bracket réellement incomplet).
  }

  // Sofia_Admin : bracket complet (15/15), validé.
  {
    const b = await createBracket("Sofia_Admin", { validated: true });
    await pick(b, round1["BOS-MIA"], "MIA", "4-2");
    await pick(b, round1["NYK-ATL"], "NYK", "4-2");
    await pick(b, round1["MIL-CHI"], "MIL", "4-1");
    await pick(b, round1["CLE-ORL"], "CLE", "4-3");
    await pick(b, round1["OKC-SAS"], "SAS", "4-1");
    await pick(b, round1["DEN-SAC"], "SAC", "4-2");
    await pick(b, round1["MIN-GSW"], "GSW", "4-0");
    await pick(b, round1["LAL-HOU"], "LAL", "4-3");
    await pick(b, confSemis["EAST-1"].id, "NYK", "4-2"); // MIA vs NYK selon SES picks
    await pick(b, confSemis["EAST-2"].id, "CLE", "4-3"); // MIL vs CLE selon SES picks
    await pick(b, confSemis["WEST-1"].id, "SAS", "4-1"); // SAS vs SAC
    await pick(b, confSemis["WEST-2"].id, "LAL", "4-0"); // GSW vs LAL
    await pick(b, confFinals["EAST"].id, "CLE", "4-2"); // NYK vs CLE
    await pick(b, confFinals["WEST"].id, "LAL", "4-3"); // SAS vs LAL
    await pick(b, finals.id, "LAL", "4-2"); // CLE vs LAL → championne
  }

  // Chloe_B : bracket à peine commencé (3/15), avec des picks parfois
  // différents d'Amine/Sofia sur les mêmes séries (fait apparaître plusieurs
  // groupes distincts au drill-down, sous le seuil de 11 → comptage brut,
  // jamais de pourcentage — cf. GAPS_OUVERTS si on veut aussi vérifier le
  // seuil ≥11, non couvert par ce lot).
  {
    const b = await createBracket("Chloe_B");
    await pick(b, round1["NYK-ATL"], "ATL", "4-3");
    await pick(b, round1["MIL-CHI"], "CHI", "4-2");
    await pick(b, round1["LAL-HOU"], "HOU", "4-1");
  }

  // ── 7. Pronos match (états variés) ──────────────────────────────────────
  // Insertion TOUJOURS en DRAFT d'abord (fidèle au vrai flux), validation en
  // 2e étape séparée si demandé.
  async function insertPrediction(pseudo, matchKey, { winner, margin = null, validate = false }) {
    const row = ok(
      `prono ${pseudo} sur ${matchKey}`,
      await supabase
        .from("match_predictions")
        .insert({
          competition_id: competitionId,
          user_id: userId[pseudo],
          match_id: matchId[matchKey],
          predicted_winner_team_id: winner ? teamId[winner] : null,
          predicted_margin: margin,
        })
        .select("id")
        .single()
    );
    if (validate) {
      ok(
        `validation du prono ${pseudo} sur ${matchKey}`,
        await supabase
          .from("match_predictions")
          .update({ status: "VALIDATED", validated_at: new Date().toISOString() })
          .eq("id", row.id)
      );
    }
    return row.id;
  }

  // Amine92 : 3 pronos VALIDÉS.
  await insertPrediction("Amine92", "BOS-MIA-1", { winner: "BOS", margin: 6, validate: true });
  await insertPrediction("Amine92", "NYK-ATL-1", { winner: "NYK", margin: 4, validate: true });
  await insertPrediction("Amine92", "OKC-SAS-1", { winner: "OKC", margin: 9, validate: true });

  // Chloe_B : 1 brouillon COMPLET non validé, 1 brouillon PARTIEL — le cas
  // que le correctif T6b §3.1 (23/07/2026) rend justement possible ; sans
  // lui cette ligne ne serait pas insérable par un joueur réel.
  await insertPrediction("Chloe_B", "MIL-CHI-1", { winner: "MIL", margin: 5 });
  await insertPrediction("Chloe_B", "LAL-HOU-1", { winner: "LAL", margin: null }); // partiel : écart absent

  // Marco_D : 1 prono VALIDÉ, posé AVANT sa désactivation (§9, plus bas).
  await insertPrediction("Marco_D", "DEN-SAC-1", { winner: "DEN", margin: 7, validate: true });

  // Nina_R : 1 brouillon complet, non validé.
  await insertPrediction("Nina_R", "MIL-CHI-1", { winner: "CHI", margin: 2 });

  // Yanis44 : validé PUIS corrigé par l'admin sur requête (0.2.3 §7) — le
  // workflow complet est rejoué (insert, puis 2 update séparés), ce qui
  // exerce réellement le trigger enforce_prediction_correction plutôt que
  // de poser directement le résultat final.
  {
    const predictionId = await insertPrediction("Yanis44", "CLE-ORL-1", {
      winner: "CLE",
      margin: 3,
      validate: true,
    });

    const request = ok(
      "requête de correction de Yanis44",
      await supabase
        .from("correction_requests")
        .insert({
          requester_user_id: userId["Yanis44"],
          target_type: "MATCH_PREDICTION",
          target_match_prediction_id: predictionId,
          justification: "Erreur de saisie : je voulais mettre 8 points d'écart, pas 3.",
          proposed_winner_team_id: teamId["CLE"],
          proposed_margin: 8,
        })
        .select("id")
        .single()
    );

    ok(
      "correction du prono de Yanis44 par Sofia_Admin",
      await supabase
        .from("match_predictions")
        .update({
          predicted_margin: 8,
          is_admin_corrected: true,
          corrected_by_admin_id: userId["Sofia_Admin"],
          correction_request_id: request.id,
          correction_reason: "Corrigé sur requête du joueur : écart erroné (3 → 8).",
        })
        .eq("id", predictionId)
    );

    ok(
      "clôture de la requête de Yanis44",
      await supabase
        .from("correction_requests")
        .update({
          status: "PROCESSED",
          handled_by_admin_id: userId["Sofia_Admin"],
          handled_at: new Date().toISOString(),
        })
        .eq("id", request.id)
    );
  }

  // ── 8. Paris de Nina_R (annulé neutralisé, refusé reproposable, brouillon) ─
  // Insérés directement dans leur état final : le trigger trg_bet_transitions
  // ne garde que les UPDATE, pas les INSERT — légal, mais on garde quand même
  // un historique de dates plausible plutôt qu'un statut sec sans passé.
  ok(
    "pari CANCELLED de Nina_R",
    await supabase.from("bets").insert({
      competition_id: competitionId,
      user_id: userId["Nina_R"],
      scope: "SERIES",
      series_id: round1["BOS-MIA"],
      description:
        "Le vainqueur de la série gagne au moins 2 matchs avec 15 points d'écart ou plus cumulés",
      proposed_category: "TEAM_PROP",
      validated_category: "TEAM_PROP",
      proposed_difficulty: 3,
      validated_difficulty: 3,
      status: "CANCELLED",
      submitted_at: hoursFromNow(-72),
      validated_at: hoursFromNow(-48),
      validated_by_admin_id: userId["Sofia_Admin"],
      resolved_at: hoursFromNow(-24),
      resolved_by_admin_id: userId["Sofia_Admin"],
      resolution_reason: "Série reportée — pari neutralisé, aucun point retiré ni accordé.",
      // points_awarded / scored_at volontairement absents : un pari annulé
      // n'est jamais scoré (neutralisé ≠ résolu), on ne fabrique pas de 0.
    })
  );

  ok(
    "pari REJECTED de Nina_R",
    await supabase.from("bets").insert({
      competition_id: competitionId,
      user_id: userId["Nina_R"],
      scope: "MATCH",
      series_id: round1["OKC-SAS"],
      match_id: matchId["OKC-SAS-1"],
      description: "Un joueur d'OKC marque plus de 30 points",
      proposed_category: "PLAYER_PROP",
      proposed_difficulty: 4,
      status: "REJECTED",
      submitted_at: hoursFromNow(-12),
      refusal_reason: "Description trop vague : aucun joueur identifié nommément.",
      // Pas de validated_by_admin_id : le schéma n'a pas de colonne dédiée à
      // "qui a refusé" — on ne force pas la colonne "validated_*" pour un
      // pari qui n'a jamais été validé.
    })
  );

  ok(
    "pari DRAFT de Nina_R",
    await supabase.from("bets").insert({
      competition_id: competitionId,
      user_id: userId["Nina_R"],
      scope: "MATCH",
      series_id: round1["NYK-ATL"],
      match_id: matchId["NYK-ATL-1"],
      description: "Plus de 3 lancers francs manqués par ATL au 4e quart-temps",
      proposed_category: "PERIOD",
      proposed_difficulty: 2,
      status: "DRAFT",
    })
  );

  // ── 9. Désactivation de Marco_D (APRÈS son prono validé, §7) ────────────
  // Conserve ses points/prono (0.2.7 §3) — seul le droit d'écrire est retiré.
  ok(
    "désactivation de Marco_D",
    await supabase.from("users").update({ status: "DISABLED" }).eq("id", userId["Marco_D"])
  );

  // ── 10. Récapitulatif (pour retrouver / nettoyer ce jeu de données) ─────
  console.log("\n=== SEED TERMINÉ ===");
  console.log("Compétition :", competitionId, "— code de rejoin :", joinCode);
  console.log("Deadline bracket / coup d'envoi BOS-MIA #1 :", E1_GAME1_AT);
  console.log("Comptes créés :");
  for (const [pseudo, id] of Object.entries(userId)) {
    console.log(`  - ${pseudo} : ${id}`);
  }
}

main().then(() => {
  console.log("\nTerminé sans erreur.");
  process.exit(0);
});
