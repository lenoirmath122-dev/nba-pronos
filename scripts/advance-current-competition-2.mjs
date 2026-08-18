#!/usr/bin/env node
// ============================================================================
// 2e vague d'avancement de la compétition ACTIVE ("Play offs test", 18/08/2026)
// — suite de scripts/advance-current-competition.mjs, APRÈS que l'utilisateur
// a posé ses propres pronos (compte réel Rillettes-31) sur les 4 matchs alors
// SCHEDULED (ATL-BOS #1, DAL-DEN #4, DET-IND #5, LAC-LAL #1).
//
// NE TOUCHE JAMAIS aux lignes de Rillettes-31/Demo_Amis (aucun INSERT/UPDATE/
// DELETE sur match_predictions/bets/bracket_picks/brackets pour ces 2
// comptes) — uniquement des matchs. Les pronos DÉJÀ posés par Rillettes-31
// sur les 4 matchs résolus ci-dessous seront scorés par la passe de scoring
// (recomputeMatch), comme tout prono gelé sur un match qui se termine — c'est
// précisément l'effet recherché par la demande.
//
// Même patron que advance-current-competition.mjs (fonctions de scoring/
// avancement copiées verbatim) : lit la structure existante, n'invente rien.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { deriveSeriesOutcome, scoreMatchPrediction, scoreBracketPick } from "../lib/scoring/engine.ts";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
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
  const competition = ok(
    'lecture de la compétition active "Play offs test"',
    await supabase.from("competitions").select("id, name").eq("status", "ACTIVE").single()
  );
  if (competition.name !== "Play offs test") throw new Error(`Compétition active inattendue : "${competition.name}" — arrêt.`);
  const competitionId = competition.id;

  const { data: teamsData } = await supabase.from("teams").select("id, abbreviation");
  const abbrById = Object.fromEntries(teamsData.map((t) => [t.id, t.abbreviation]));
  const teamId = Object.fromEntries(teamsData.map((t) => [t.abbreviation, t.id]));

  const seriesRows = ok(
    "lecture des séries",
    await supabase.from("series").select("id, round, team1_id, team2_id").eq("competition_id", competitionId)
  );
  const round1 = seriesRows.filter((s) => s.round === "ROUND_1");
  const round1ByKey = Object.fromEntries(round1.map((s) => [`${abbrById[s.team1_id]}-${abbrById[s.team2_id]}`, s]));

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, series_id, game_number, home_team_id, away_team_id, status")
    .eq("competition_id", competitionId);

  function matchByKey(key, gameNumber) {
    const series = round1ByKey[key];
    return existingMatches.find((m) => m.series_id === series.id && m.game_number === gameNumber);
  }

  const newMatchIds = []; // toutes les lignes insérées OU mises à jour (à rescorer)

  async function updateToFinished(key, gameNumber, homeScore, awayScore) {
    const m = matchByKey(key, gameNumber);
    if (!m) throw new Error(`Match ${key} #${gameNumber} introuvable — arrêt.`);
    ok(
      `${key} #${gameNumber} → FINISHED ${homeScore}-${awayScore}`,
      await supabase.from("matches").update({ status: "FINISHED", home_score: homeScore, away_score: awayScore }).eq("id", m.id)
    );
    newMatchIds.push(m.id);
  }

  async function insertGame(key, gameNumber, home, away, dayOffset, finished, homeScore, awayScore) {
    const series = round1ByKey[key];
    const row = ok(
      `${key} #${gameNumber} (${finished ? `FINISHED ${homeScore}-${awayScore}` : "SCHEDULED"})`,
      await supabase
        .from("matches")
        .insert({
          competition_id: competitionId,
          series_id: series.id,
          game_number: gameNumber,
          scheduled_at: daysFromNow(dayOffset),
          home_team_id: teamId[home],
          away_team_id: teamId[away],
          ...(finished ? { status: "FINISHED", home_score: homeScore, away_score: awayScore } : {}),
        })
        .select("id")
        .single()
    );
    newMatchIds.push(row.id);
    return row.id;
  }

  // ── DET-IND : 2-2, G5 déjà SCHEDULED le 20/08 (pronostiqué par Rillettes-31) ──
  // BUG trouvé après exécution (home/away inversés dans le commentaire
  // d'origine, pas dans la donnée) : G5 a home=DET (pas IND, vérifié dans
  // l'inspection avant écriture) — le score ci-dessous fait donc GAGNER DET,
  // pas IND. Conséquence assumée plutôt que recorrigée après coup : la série
  // finit 3-3 au lieu du 4-2 initialement voulu, G7 ajouté séparément
  // (scripts/add-det-ind-g7.mjs, replié ici) pour lui donner une suite.
  await updateToFinished("DET-IND", 5, 108, 101); // home=DET -> DET gagne -> 3-2 DET
  await insertGame("DET-IND", 6, "IND", "DET", 3, true, 100, 92); // home=IND -> IND gagne -> 3-3
  await insertGame("DET-IND", 7, "DET", "IND", 5, false, null, null); // décisif, reste EN COURS

  // ── DAL-DEN : DAL 2-1, G4 déjà SCHEDULED (pronostiqué par Rillettes-31) ──
  await updateToFinished("DAL-DEN", 4, 105, 98); // home=DEN (cf. inspection), DEN gagne -> 2-2
  await insertGame("DAL-DEN", 5, "DAL", "DEN", 3, false, null, null); // reste EN COURS, prochain match à venir

  // ── GSW-HOU : GSW 1-0 (G1 le 17/08), aucun autre match posé ──────────────
  await insertGame("GSW-HOU", 2, "HOU", "GSW", 0, true, 104, 99); // après G1 (17/08) -> aujourd'hui ; HOU gagne -> 1-1
  await insertGame("GSW-HOU", 3, "GSW", "HOU", 1, true, 111, 102); // GSW gagne -> 2-1
  await insertGame("GSW-HOU", 4, "HOU", "GSW", 3, false, null, null); // reste EN COURS

  // ── ATL-BOS : G1 déjà SCHEDULED (pronostiqué par Rillettes-31 ET TestJoueur3) ──
  {
    const g1 = matchByKey("ATL-BOS", 1);
    const homeAbbr = abbrById[g1.home_team_id];
    const awayAbbr = abbrById[g1.away_team_id];
    await updateToFinished("ATL-BOS", 1, 104, 99); // home gagne d'un écart plausible (reste daté ce soir, 18/08)
    const otherHome = awayAbbr; // match retour, domicile inversé
    const otherAway = homeAbbr;
    await insertGame("ATL-BOS", 2, otherHome, otherAway, 1, true, 97, 93); // après G1 (soir même) -> 19/08 ; domicile gagne -> 1-1
    await insertGame("ATL-BOS", 3, homeAbbr, awayAbbr, 3, false, null, null); // reste EN COURS
  }

  // ── LAC-LAL : G1 déjà SCHEDULED (pronostiqué par Rillettes-31) ──────────
  {
    const g1 = matchByKey("LAC-LAL", 1);
    const homeAbbr = abbrById[g1.home_team_id];
    const awayAbbr = abbrById[g1.away_team_id];
    await updateToFinished("LAC-LAL", 1, 100, 94);
    await insertGame("LAC-LAL", 2, awayAbbr, homeAbbr, 4, false, null, null); // reste EN COURS
  }

  // ── MEM-MIN : aucun match encore posé — 1er match programmé ──────────────
  await insertGame("MEM-MIN", 1, "MEM", "MIN", 3, false, null, null);

  // ── Pronos des 4 TestJoueur sur TOUS les nouveaux matchs (pas ceux déjà
  //    pronostiqués la 1ère vague, qui gardent leurs pronos existants) ──────
  const PLAYERS = [
    { pseudo: "TestJoueur1", skill: 0.8 },
    { pseudo: "TestJoueur2", skill: 0.55 },
    { pseudo: "TestJoueur3", skill: 0.35 },
    { pseudo: "TestJoueur4", skill: 0.65 },
  ];
  const { data: userRows } = await supabase.from("users").select("id, pseudo").in("pseudo", PLAYERS.map((p) => p.pseudo));
  const userId = Object.fromEntries(userRows.map((u) => [u.pseudo, u.id]));

  // Seuls les matchs FRAÎCHEMENT INSÉRÉS ont besoin d'un nouveau prono — ceux
  // mis à jour (updateToFinished) avaient déjà leurs pronos de la 1ère vague
  // (TestJoueur1-4 avaient déjà pronostiqué TOUS les matchs existants,
  // §2.73). On ne pronostique donc que les lignes réellement INSERT-ées.
  const insertedOnlyIds = newMatchIds.filter((id) => !existingMatches.some((m) => m.id === id));
  const { data: freshMatches } = await supabase.from("matches").select("id, home_team_id, away_team_id, home_score, away_score, status").in("id", insertedOnlyIds);

  for (const p of PLAYERS) {
    const rng = mulberry32(seedFromString(p.pseudo + "-preds2"));
    for (const m of freshMatches) {
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
        .insert({ competition_id: competitionId, user_id: userId[p.pseudo], match_id: m.id, predicted_winner_team_id: teamId[predictedWinner], predicted_margin: predictedMargin })
        .select("id")
        .single();
      if (error) {
        console.error(`ÉCHEC — prono ${p.pseudo} sur match ${m.id} :`, error.message);
        process.exit(1);
      }
      if (rng() < 0.7) {
        await supabase.from("match_predictions").update({ status: "VALIDATED", validated_at: new Date().toISOString() }).eq("id", predRow.id);
      }
    }
    console.log(`OK — ${freshMatches.length} nouveaux pronos de ${p.pseudo}`);
  }

  // ── Scoring + avancement (copié verbatim des 2 scripts précédents) ──────
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
  for (const id of newMatchIds) await recomputeMatch(id);
  for (const key of Object.keys(round1ByKey)) await advanceWinnerIfDecided(round1ByKey[key].id);
  for (const s of seriesRows.filter((s) => s.round === "CONF_SEMIS")) await recomputeSeries(s.id);
  console.log("OK — scoring + avancement terminés");

  // bracket_deadline : aucun nouveau match n'est antérieur au plus ancien
  // déjà en base (02/08) — rien à recalculer, vérifié explicitement plutôt
  // que supposé (même prudence que le bug du script précédent).
  const { data: earliest } = await supabase.from("matches").select("scheduled_at").eq("competition_id", competitionId).not("scheduled_at", "is", null).order("scheduled_at", { ascending: true }).limit(1).single();
  const { data: comp } = await supabase.from("competitions").select("bracket_deadline").eq("id", competitionId).single();
  console.log(`\nbracket_deadline toujours cohérente : ${comp.bracket_deadline === earliest.scheduled_at ? "OUI" : "NON — À CORRIGER"}`);

  console.log("\n=== TERMINÉ === Compétition inchangée :", competitionId, "(toujours ACTIVE)");
}

main().then(() => {
  console.log("\nTerminé sans erreur.");
  process.exit(0);
});
