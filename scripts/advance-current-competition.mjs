#!/usr/bin/env node
// ============================================================================
// AVANCE la compétition ACTIVE actuelle ("Play offs test") avec les 4 comptes
// TestJoueur1-4 déjà existants — demandé par l'utilisateur le 18/08/2026 pour
// observer la refonte de l'onglet Jouer en situation réelle.
//
// DIFFÉRENCE avec scripts/seed-playoffs-simulation.mjs (dont ce script
// réutilise les fonctions de scoring/avancement à l'identique, copiées
// verbatim) : NE CRÉE NI compétition NI équipes NI séries NI comptes — la
// compétition "Play offs test" (créée le 17/08/2026) est réutilisée TELLE
// QUELLE (15 séries, 1er tour déjà apparié), tout comme les 4 comptes
// TestJoueur1-4 (déjà existants, PLAYER, aucune activité). N'ARCHIVE RIEN :
// la compétition reste ACTIVE, les données de Rillettes-31 (bracket validé,
// 1 prono, 1 pari) et Demo_Amis (compte réel d'amis, jamais touché) restent
// intactes — vérifié en lecture seule avant d'écrire quoi que ce soit
// (scripts/inspect-current-state.mjs).
//
// SÉCURITÉ : service_role (contourne la RLS). RLS non désactivée nulle part.
// Idempotence : PAS garantie si relancé (insère sans vérifier l'existant sur
// les 7 séries sans match) — usage prévu : une seule exécution.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { deriveSeriesOutcome, scoreMatchPrediction, scoreBracketPick } from "../lib/scoring/engine.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées (--env-file=.env.local)");
}

const ACTIVE_COMPETITION_NAME = "Play offs test";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

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
  // ── 0. Compétition ACTIVE = "Play offs test", réutilisée telle quelle ──
  const competition = ok(
    `lecture de la compétition active "${ACTIVE_COMPETITION_NAME}"`,
    await supabase.from("competitions").select("id, name, type").eq("status", "ACTIVE").single()
  );
  if (competition.name !== ACTIVE_COMPETITION_NAME) {
    throw new Error(`La compétition active est "${competition.name}", pas "${ACTIVE_COMPETITION_NAME}" — arrêt par précaution.`);
  }
  const competitionId = competition.id;

  // ── 1. Séries existantes (déjà appariées pour le 1er tour) ──────────────
  const seriesRows = ok(
    "lecture des 15 séries",
    await supabase
      .from("series")
      .select("id, round, conference, slot_index, team1_id, team2_id, next_series_id, next_series_slot")
      .eq("competition_id", competitionId)
  );
  const { data: teamsData } = await supabase.from("teams").select("id, abbreviation");
  const abbrById = Object.fromEntries((teamsData ?? []).map((t) => [t.id, t.abbreviation]));
  const teamId = Object.fromEntries((teamsData ?? []).map((t) => [t.abbreviation, t.id]));

  const round1 = seriesRows.filter((s) => s.round === "ROUND_1");
  const confSemisByConf = { EAST: [], WEST: [] };
  for (const s of seriesRows.filter((s) => s.round === "CONF_SEMIS")) confSemisByConf[s.conference].push(s);
  const confFinalsByConf = Object.fromEntries(seriesRows.filter((s) => s.round === "CONF_FINALS").map((s) => [s.conference, s]));
  const finals = seriesRows.find((s) => s.round === "NBA_FINALS");

  const round1ByKey = {}; // "ATL-BOS" -> series row
  for (const s of round1) round1ByKey[`${abbrById[s.team1_id]}-${abbrById[s.team2_id]}`] = s;
  console.log("1er tour :", Object.keys(round1ByKey).join(", "));

  // ── 2. Matchs — le match existant (1ère série de la liste, déjà posé le
  //      17/08) est laissé INTACT ; les 7 autres séries reçoivent un plan de
  //      matchs (mélange terminé/en cours/à venir, même patron que
  //      seed-playoffs-simulation.mjs mais avec les VRAIES paires de cette
  //      compétition). ────────────────────────────────────────────────────
  const { data: existingMatches } = await supabase.from("matches").select("id, series_id, game_number").eq("competition_id", competitionId);
  const seriesIdsWithMatches = new Set((existingMatches ?? []).map((m) => m.series_id));

  const keys = Object.keys(round1ByKey);
  const untouchedKey = keys.find((k) => seriesIdsWithMatches.has(round1ByKey[k].id)); // celle qui a déjà un match
  const freshKeys = keys.filter((k) => k !== untouchedKey);
  console.log(`Série déjà pourvue (laissée intacte) : ${untouchedKey}`);
  console.log(`Séries à peupler : ${freshKeys.join(", ")}`);

  // 6 plans pour 6 des 7 séries fraîches (la 7e reste sans match, pour
  // couvrir aussi le cas "série du 1er tour jamais commencée").
  const PLANS = {
    finished41: (t1, t2) => [
      { day: -16, home: t1, away: t2, homeScore: 112, awayScore: 101 },
      { day: -13, home: t1, away: t2, homeScore: 105, awayScore: 110 },
      { day: -11, home: t2, away: t1, homeScore: 98, awayScore: 104 },
      { day: -9, home: t2, away: t1, homeScore: 90, awayScore: 96 },
      { day: -6, home: t1, away: t2, homeScore: 118, awayScore: 108 },
    ],
    finished40: (t1, t2) => [
      { day: -15, home: t1, away: t2, homeScore: 120, awayScore: 99 },
      { day: -12, home: t1, away: t2, homeScore: 108, awayScore: 95 },
      { day: -10, home: t2, away: t1, homeScore: 90, awayScore: 102 },
      { day: -7, home: t2, away: t1, homeScore: 97, awayScore: 111 },
    ],
    inProgress22: (t1, t2) => [
      { day: -10, home: t1, away: t2, homeScore: 101, awayScore: 96 },
      { day: -7, home: t1, away: t2, homeScore: 94, awayScore: 99 },
      { day: -5, home: t2, away: t1, homeScore: 105, awayScore: 100 },
      { day: -2, home: t2, away: t1, homeScore: 92, awayScore: 97 },
      { day: 2, home: t1, away: t2, scheduledOnly: true },
    ],
    inProgress31: (t1, t2) => [
      { day: -9, home: t1, away: t2, homeScore: 110, awayScore: 100 },
      { day: -6, home: t1, away: t2, homeScore: 99, awayScore: 105 },
      { day: -4, home: t2, away: t1, homeScore: 91, awayScore: 98 },
      { day: 1, home: t2, away: t1, scheduledOnly: true },
    ],
    barelyStarted: (t1, t2) => [{ day: -1, home: t1, away: t2, homeScore: 103, awayScore: 97 }],
    notStarted: (t1, t2) => [{ day: 3, home: t1, away: t2, scheduledOnly: true }],
  };
  const planOrder = ["finished41", "finished40", "inProgress22", "inProgress31", "barelyStarted", "notStarted"];

  const matchId = {}; // "ATL-BOS-1" -> match id
  const gameByKey = {}; // "ATL-BOS-1" -> plan game (pour les pronos réalistes)
  for (let i = 0; i < planOrder.length && i < freshKeys.length; i++) {
    const key = freshKeys[i];
    const series = round1ByKey[key];
    const [t1, t2] = key.split("-");
    const games = PLANS[planOrder[i]](t1, t2);
    for (let g = 0; g < games.length; g++) {
      const game = games[g];
      const gameNumber = g + 1;
      const row = ok(
        `match ${key} #${gameNumber} (${planOrder[i]})`,
        await supabase
          .from("matches")
          .insert({
            competition_id: competitionId,
            series_id: series.id,
            game_number: gameNumber,
            scheduled_at: daysFromNow(game.day),
            home_team_id: teamId[game.home],
            away_team_id: teamId[game.away],
            ...(game.scheduledOnly ? {} : { status: "FINISHED", home_score: game.homeScore, away_score: game.awayScore }),
          })
          .select("id")
          .single()
      );
      matchId[`${key}-${gameNumber}`] = row.id;
      gameByKey[`${key}-${gameNumber}`] = game;
    }
  }
  // La 7e clé fraîche (au-delà des 6 plans) reste volontairement sans match
  // — série du 1er tour "jamais commencée" (aucune ligne dans matches).
  const untouchedSeriesMatch = ok(
    `match existant de ${untouchedKey}`,
    await supabase.from("matches").select("id, game_number").eq("series_id", round1ByKey[untouchedKey].id).single()
  );
  matchId[`${untouchedKey}-${untouchedSeriesMatch.game_number}`] = untouchedSeriesMatch.id;

  // bracket_deadline = heure du 1er match (game_number=1) le plus tôt, tous
  // les 1ers tours confondus (même définition que recomputeBracketDeadline(),
  // lib/actions/admin-results.ts) — BUG RÉEL trouvé le 18/08/2026 : la
  // 1ère version de ce script n'appelait jamais ce recalcul, alors que les
  // matchs insérés ci-dessus sont pour la plupart antérieurs au seul match
  // déjà présent avant ce script. La deadline restait bloquée sur l'heure de
  // CE match-là (dans le futur), empêchant /play/bracket de basculer vers la
  // vue globale /bracket (isDeadlinePassed resté faux) malgré des séries déjà
  // FINISHED — corrigé en base à la main ce jour-là, et ici pour de bon.
  const { data: earliestGame1 } = await supabase
    .from("matches")
    .select("scheduled_at")
    .eq("competition_id", competitionId)
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .single();
  ok(
    "bracket_deadline recalculée (match le plus tôt)",
    await supabase.from("competitions").update({ bracket_deadline: earliestGame1.scheduled_at }).eq("id", competitionId)
  );

  // ── 3. Les 4 TestJoueur — brackets complets (15 picks chacun) ───────────
  const PLAYERS = [
    { pseudo: "TestJoueur1", skill: 0.8 },
    { pseudo: "TestJoueur2", skill: 0.55 },
    { pseudo: "TestJoueur3", skill: 0.35 },
    { pseudo: "TestJoueur4", skill: 0.65 },
  ];
  const { data: userRows } = await supabase.from("users").select("id, pseudo").in("pseudo", [...PLAYERS.map((p) => p.pseudo), "Rillettes-31"]);
  const userId = Object.fromEntries((userRows ?? []).map((u) => [u.pseudo, u.id]));
  for (const p of PLAYERS) {
    if (!userId[p.pseudo]) throw new Error(`Compte ${p.pseudo} introuvable — arrêt.`);
  }
  if (!userId["Rillettes-31"]) throw new Error("Compte admin Rillettes-31 introuvable — arrêt.");
  const adminUserId = userId["Rillettes-31"];

  // Vainqueur "vrai" narratif par série 1er tour, dérivé du plan choisi
  // (finished* => vainqueur réel du score ; en cours/pas commencé => équipe1
  // par convention, jamais écrit en `official_*`, sert juste à générer des
  // picks plausibles pour les tours suivants).
  const trueWinner = {};
  trueWinner[untouchedKey] = untouchedKey.split("-")[0];
  for (let i = 0; i < planOrder.length && i < freshKeys.length; i++) {
    const key = freshKeys[i];
    const [t1, t2] = key.split("-");
    const games = PLANS[planOrder[i]](t1, t2);
    const finishedGames = games.filter((g) => !g.scheduledOnly);
    const wins = { [t1]: 0, [t2]: 0 };
    for (const g of finishedGames) wins[g.homeScore > g.awayScore ? g.home : g.away]++;
    trueWinner[key] = wins[t1] >= wins[t2] ? t1 : t2; // provisoire si série pas finie, sans conséquence (narratif)
  }

  const SCORE_FORMATS = ["4-0", "4-1", "4-2", "4-3"];
  function weightedFormat(rng) {
    const r = rng();
    if (r < 0.12) return SCORE_FORMATS[0];
    if (r < 0.35) return SCORE_FORMATS[1];
    if (r < 0.68) return SCORE_FORMATS[2];
    return SCORE_FORMATS[3];
  }

  const bracketId = {};
  for (const p of PLAYERS) {
    const rng = mulberry32(seedFromString(p.pseudo + "-bracket"));
    const validated = rng() < 0.7;
    const b = ok(
      `bracket de ${p.pseudo}`,
      await supabase
        .from("brackets")
        .insert({ user_id: userId[p.pseudo], competition_id: competitionId, is_validated: validated, validated_at: validated ? new Date().toISOString() : null })
        .select("id")
        .single()
    );
    bracketId[p.pseudo] = b.id;

    async function pick(seriesId, winnerAbbrev, otherAbbrev) {
      const guessRight = rng() < p.skill;
      const winner = guessRight ? winnerAbbrev : otherAbbrev;
      await supabase.from("bracket_picks").insert({
        competition_id: competitionId,
        bracket_id: b.id,
        series_id: seriesId,
        predicted_winner_team_id: teamId[winner],
        predicted_score_format: weightedFormat(rng),
      });
    }

    for (const key of keys) {
      const [t1, t2] = key.split("-");
      await pick(round1ByKey[key].id, trueWinner[key], trueWinner[key] === t1 ? t2 : t1);
    }
    for (const conf of ["EAST", "WEST"]) {
      const [semisA, semisB] = confSemisByConf[conf];
      const feederA = keys.find((k) => round1ByKey[k].next_series_id === semisA.id);
      const feederB = keys.find((k) => round1ByKey[k].next_series_id === semisB.id);
      await pick(semisA.id, trueWinner[feederA], feederA.split("-").find((t) => t !== trueWinner[feederA]));
      await pick(semisB.id, trueWinner[feederB], feederB.split("-").find((t) => t !== trueWinner[feederB]));
    }
    // CONF_FINALS / NBA_FINALS : picks narratifs simples (une des équipes
    // encore "en vie" côté vrai résultat, approximation assumée — donnée de
    // test, jamais vérifiée contre une paire officielle à ce stade).
    const eastPick = trueWinner[keys.find((k) => round1ByKey[k].next_series_id === confSemisByConf.EAST[0].id)];
    const westPick = trueWinner[keys.find((k) => round1ByKey[k].next_series_id === confSemisByConf.WEST[0].id)];
    await pick(confFinalsByConf.EAST.id, eastPick, "BOS");
    await pick(confFinalsByConf.WEST.id, westPick, "DEN");
    await pick(finals.id, rng() < 0.5 ? eastPick : westPick, rng() < 0.5 ? westPick : eastPick);
    console.log(`OK — 15 picks de ${p.pseudo} (bracket ${validated ? "validé" : "brouillon"})`);
  }

  // ── 4. Pronos match des 4 TestJoueur ─────────────────────────────────────
  // Sur TOUS les matchs déjà créés (joués ET à venir) : un vrai joueur
  // pronostique avant le coup d'envoi, pas seulement après coup.
  const { data: allMatches } = await supabase.from("matches").select("id, home_team_id, away_team_id, home_score, away_score, status").eq("competition_id", competitionId);
  for (const p of PLAYERS) {
    const rng = mulberry32(seedFromString(p.pseudo + "-preds"));
    let count = 0;
    for (const m of allMatches ?? []) {
      // Le match déjà présent le 17/08 (ATL vs BOS) porte déjà un pari de
      // Rillettes-31 mais pas de contrainte d'unicité de prono par joueur —
      // rien n'empêche les TestJoueur d'y pronostiquer aussi.
      const homeAbbr = abbrById[m.home_team_id];
      const awayAbbr = abbrById[m.away_team_id];
      const played = m.status === "FINISHED" && m.home_score !== null;
      const actualWinner = played ? (m.home_score > m.away_score ? homeAbbr : awayAbbr) : null;
      const loser = played ? (actualWinner === homeAbbr ? awayAbbr : homeAbbr) : null;
      const guessRight = rng() < p.skill;
      const predictedWinner = played ? (guessRight ? actualWinner : loser) : rng() < 0.5 ? homeAbbr : awayAbbr;
      const actualMargin = played ? Math.abs(m.home_score - m.away_score) : null;
      const predictedMargin =
        actualMargin !== null
          ? Math.max(1, Math.min(50, actualMargin + Math.round((rng() - 0.5) * (p.skill > 0.6 ? 4 : 12))))
          : Math.max(1, Math.min(50, Math.round(4 + rng() * 14)));

      const { data: predRow, error } = await supabase
        .from("match_predictions")
        .insert({
          competition_id: competitionId,
          user_id: userId[p.pseudo],
          match_id: m.id,
          predicted_winner_team_id: teamId[predictedWinner],
          predicted_margin: predictedMargin,
        })
        .select("id")
        .single();
      if (error) {
        console.error(`ÉCHEC — prono ${p.pseudo} sur match ${m.id} :`, error.message);
        process.exit(1);
      }
      // Validé pour la plupart (verrouillage réel possible seulement si déjà
      // commencé — pour un match encore à venir, VALIDATED reste légitime,
      // c'est l'acte volontaire du joueur) ; sinon laissé DRAFT complet
      // (auto-validation à la deadline, jamais invoquée dans ce code — état
      // "prêt" observable tel quel).
      if (rng() < 0.7) {
        await supabase.from("match_predictions").update({ status: "VALIDATED", validated_at: new Date().toISOString() }).eq("id", predRow.id);
      }
      count++;
    }
    console.log(`OK — ${count} pronos de ${p.pseudo}`);
  }

  // Quelques brouillons PARTIELS (vainqueur seul, pas d'écart) sur le match
  // encore à venir déjà présent le 17/08 (ATL-BOS #1), pour la diversité
  // d'états (à la place des pronos complets déjà insérés ci-dessus pour
  // TestJoueur3 uniquement — on écrase son prono complet par un partiel).
  {
    const untouchedMatchId = matchId[`${untouchedKey}-1`];
    await supabase.from("match_predictions").delete().eq("match_id", untouchedMatchId).eq("user_id", userId["TestJoueur3"]);
    await supabase.from("match_predictions").insert({
      competition_id: competitionId,
      user_id: userId["TestJoueur3"],
      match_id: untouchedMatchId,
      predicted_winner_team_id: teamId[untouchedKey.split("-")[0]],
      predicted_margin: null,
    });
    console.log(`OK — prono brouillon partiel de TestJoueur3 sur ${untouchedKey} #1`);
  }

  // ── 5. Paris personnalisés — variété de statuts ─────────────────────────
  const firstFreshKey = freshKeys[0]; // finished41
  const secondFreshKey = freshKeys[1]; // finished40
  const thirdFreshKey = freshKeys[2]; // inProgress22
  const bets = [
    {
      pseudo: "TestJoueur1",
      scope: "SERIES",
      seriesKey: firstFreshKey,
      description: `${firstFreshKey.split("-")[0]} gagne la série en 5 matchs maximum`,
      category: "TEAM_PROP",
      difficulty: 3,
      status: "WON",
      resolved: true,
      won: true,
    },
    {
      pseudo: "TestJoueur2",
      scope: "MATCH",
      seriesKey: secondFreshKey,
      matchKey: `${secondFreshKey}-1`,
      description: `${secondFreshKey.split("-")[1]} marque moins de 100 points`,
      category: "SCORE_TOTAL",
      difficulty: 2,
      status: "LOST",
      resolved: true,
      won: false,
    },
    {
      pseudo: "TestJoueur3",
      scope: "MATCH",
      seriesKey: thirdFreshKey,
      matchKey: `${thirdFreshKey}-2`,
      description: `Écart final inférieur à 10 points`,
      category: "SCORE_TOTAL",
      difficulty: 2,
      status: "DRAFT",
    },
    {
      pseudo: "TestJoueur4",
      scope: "MATCH",
      seriesKey: untouchedKey,
      matchKey: `${untouchedKey}-1`,
      description: `Le premier panier est à 3 points`,
      category: "GAME_EVENT",
      difficulty: 4,
      status: "SUBMITTED",
    },
    {
      pseudo: "TestJoueur1",
      scope: "MATCH",
      seriesKey: thirdFreshKey,
      matchKey: `${thirdFreshKey}-1`,
      description: "Pari refusé pour l'exemple (formulation trop vague)",
      category: "FUN_OFF_COURT",
      difficulty: 1,
      status: "REJECTED",
      refusalReason: "Formulation trop vague, pas mesurable objectivement.",
    },
    {
      pseudo: "TestJoueur2",
      scope: "MATCH",
      seriesKey: firstFreshKey,
      matchKey: `${firstFreshKey}-3`,
      description: "Pari retiré par le joueur avant revue",
      category: "TEAM_PROP",
      difficulty: 2,
      status: "CANCELLED",
    },
  ];
  for (const b of bets) {
    const seriesRow = round1ByKey[b.seriesKey];
    const payload = {
      competition_id: competitionId,
      user_id: userId[b.pseudo],
      scope: b.scope,
      series_id: seriesRow.id,
      match_id: b.matchKey ? matchId[b.matchKey] : null,
      description: b.description,
      proposed_category: b.category,
      proposed_difficulty: b.difficulty,
      status: b.status,
    };
    if (b.status !== "DRAFT") {
      payload.submitted_at = daysFromNow(-5);
    }
    if (b.status === "WON" || b.status === "LOST" || b.status === "REJECTED" || b.status === "CANCELLED" || b.status === "VALIDATED") {
      payload.validated_category = b.category;
      payload.validated_difficulty = b.difficulty;
      payload.validated_at = daysFromNow(-4);
      payload.validated_by_admin_id = adminUserId;
    }
    if (b.resolved) {
      payload.resolved_at = daysFromNow(-1);
      payload.resolved_by_admin_id = adminUserId;
      payload.points_awarded = b.won ? 10 : null;
      payload.resolution_reason = b.won ? "Condition remplie." : "Condition non remplie.";
    }
    if (b.status === "REJECTED") payload.refusal_reason = b.refusalReason;

    const { error } = await supabase.from("bets").insert(payload);
    if (error) {
      console.error(`ÉCHEC — pari ${b.pseudo} (${b.status}) :`, error.message);
      process.exit(1);
    }
    console.log(`OK — pari ${b.status} de ${b.pseudo}`);
  }

  // ── 6. Scoring + avancement (copié verbatim de seed-playoffs-simulation.mjs) ──
  async function recomputeMatch(matchIdValue) {
    const { data: matchRow } = await supabase.from("matches").select("id, series_id, status, home_team_id, away_team_id, home_score, away_score").eq("id", matchIdValue).single();
    const officialMatch = { id: matchRow.id, status: matchRow.status, homeTeamId: matchRow.home_team_id, awayTeamId: matchRow.away_team_id, homeScore: matchRow.home_score, awayScore: matchRow.away_score };

    const { data: predictionsData } = await supabase.from("match_predictions").select("id, predicted_winner_team_id, predicted_margin, status").eq("match_id", matchIdValue);
    for (const prediction of predictionsData ?? []) {
      const isFrozen = prediction.status === "VALIDATED" || prediction.status === "LOCKED" || (prediction.predicted_winner_team_id !== null && prediction.predicted_margin !== null);
      const score = scoreMatchPrediction({ predictedWinnerTeamId: prediction.predicted_winner_team_id, predictedMargin: prediction.predicted_margin, isFrozen }, officialMatch);
      await supabase.from("match_predictions").update({ is_winner_correct: score.isWinnerCorrect, margin_diff: score.marginDiff, winner_points: score.winnerPoints, margin_bonus_points: score.marginBonusPoints, scored_at: score.winnerPoints !== null ? new Date().toISOString() : null }).eq("id", prediction.id);
    }

    const { data: seriesRow } = await supabase.from("series").select("id, round, competition_id, official_status, official_winner_team_id, official_score_format").eq("id", matchRow.series_id).single();
    const { data: competitionRow } = await supabase.from("competitions").select("type").eq("id", seriesRow.competition_id).single();
    const { data: seriesMatchData } = await supabase.from("matches").select("id, series_id, status, home_team_id, away_team_id, home_score, away_score").eq("series_id", seriesRow.id);
    const derived = deriveSeriesOutcome((seriesMatchData ?? []).map((m) => ({ id: m.id, status: m.status, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id, homeScore: m.home_score, awayScore: m.away_score })), competitionRow?.type ?? "PLAYOFFS");

    const hasChanged = derived.status !== seriesRow.official_status || derived.winnerTeamId !== seriesRow.official_winner_team_id || derived.scoreFormat !== seriesRow.official_score_format;
    if (!hasChanged) return;
    await supabase.from("series").update({ official_status: derived.status, official_winner_team_id: derived.winnerTeamId, official_score_format: derived.scoreFormat }).eq("id", seriesRow.id);
    await recomputeSeries(seriesRow.id);
  }

  async function recomputeSeries(seriesIdValue) {
    const { data: seriesRow } = await supabase.from("series").select("id, round, competition_id, official_status, official_winner_team_id, official_score_format, team1_id, team2_id").eq("id", seriesIdValue).single();
    const { data: picksData } = await supabase.from("bracket_picks").select("id, bracket_id, series_id, predicted_winner_team_id, predicted_score_format").eq("series_id", seriesIdValue);
    const picks = picksData ?? [];
    if (picks.length === 0) return;

    const { data: feedersData } = await supabase.from("series").select("id, next_series_slot").eq("next_series_id", seriesIdValue);
    const feeders = feedersData ?? [];
    const feederSlot1Id = feeders.find((f) => f.next_series_slot === 1)?.id ?? null;
    const feederSlot2Id = feeders.find((f) => f.next_series_slot === 2)?.id ?? null;
    const feederSeriesIds = [feederSlot1Id, feederSlot2Id].filter((id) => id !== null);
    const { data: feederPicksData } = feederSeriesIds.length > 0 ? await supabase.from("bracket_picks").select("bracket_id, series_id, predicted_winner_team_id").in("series_id", feederSeriesIds) : { data: [] };
    const feederPicks = feederPicksData ?? [];

    const outcome = { status: seriesRow.official_status, winnerTeamId: seriesRow.official_winner_team_id, scoreFormat: seriesRow.official_score_format };
    const officialPair = { a: seriesRow.team1_id, b: seriesRow.team2_id };
    for (const pick of picks) {
      const predictedPair = {
        a: feederPicks.find((fp) => fp.bracket_id === pick.bracket_id && fp.series_id === feederSlot1Id)?.predicted_winner_team_id ?? null,
        b: feederPicks.find((fp) => fp.bracket_id === pick.bracket_id && fp.series_id === feederSlot2Id)?.predicted_winner_team_id ?? null,
      };
      const score = scoreBracketPick({ predictedWinnerTeamId: pick.predicted_winner_team_id, predictedScoreFormat: pick.predicted_score_format }, seriesRow.round, outcome, predictedPair, officialPair);
      const hasAnyComponent = score.winnerPoints !== null || score.exactScorePoints !== null || score.matchupPoints !== null;
      await supabase.from("bracket_picks").update({ is_winner_correct: score.isWinnerCorrect, is_score_exact: score.isScoreExact, is_matchup_correct: score.isMatchupCorrect, winner_points: score.winnerPoints, exact_score_points: score.exactScorePoints, matchup_points: score.matchupPoints, scored_at: hasAnyComponent ? new Date().toISOString() : null }).eq("id", pick.id);
    }
  }

  async function advanceWinnerIfDecided(seriesIdValue) {
    const { data: series } = await supabase.from("series").select("official_status, official_winner_team_id, next_series_id, next_series_slot").eq("id", seriesIdValue).single();
    if (!series || series.official_status !== "FINISHED") return;
    if (!series.official_winner_team_id || !series.next_series_id || !series.next_series_slot) return;
    const column = series.next_series_slot === 1 ? "team1_id" : "team2_id";
    const { data: nextSeries } = await supabase.from("series").select("team1_id, team2_id").eq("id", series.next_series_id).single();
    if (!nextSeries || nextSeries[column] !== null) return;
    await supabase.from("series").update({ [column]: series.official_winner_team_id }).eq("id", series.next_series_id);
  }

  console.log("\n--- Passe de scoring + avancement ---");
  for (const key of Object.keys(matchId)) await recomputeMatch(matchId[key]);
  for (const key of keys) await advanceWinnerIfDecided(round1ByKey[key].id);
  for (const s of seriesRows.filter((s) => s.round === "CONF_SEMIS")) await recomputeSeries(s.id);
  console.log("OK — scoring + avancement terminés");

  console.log("\n=== TERMINÉ ===");
  console.log("Compétition inchangée :", competitionId, "(toujours ACTIVE)");
  console.log("Comptes utilisés : TestJoueur1, TestJoueur2, TestJoueur3, TestJoueur4 (mots de passe déjà connus de l'utilisateur, non touchés par ce script)");
}

main().then(() => {
  console.log("\nTerminé sans erreur.");
  process.exit(0);
});
