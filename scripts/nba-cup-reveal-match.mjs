#!/usr/bin/env node
// ============================================================================
// NBA CUP ALPHA — (c) Révèle un match fictif le jour J (FINISHED + avancement)
// ============================================================================
// Fichier  : scripts/nba-cup-reveal-match.mjs
// Usage    : node --env-file=.env.local scripts/nba-cup-reveal-match.mjs --match=<matchId>
//
// Contexte : voir scripts/nba-cup-find-real-game.mjs / nba-cup-create-match.mjs
// (même chantier alpha). À lancer UNIQUEMENT le jour réel du match fictif
// (jamais avant — cf. le risque "spoiler" documenté dans
// nba-cup-create-match.mjs : un match FINISHED est visible dans Résultats
// quel que soit son scheduled_at).
//
// Dérive le score officiel depuis les VRAIES stats_box_scores du match
// emprunté (entity_mappings), puis rejoue le vrai moteur de scoring
// (lib/scoring/engine.ts, fonctions PURES importées directement) pour
// scorer les pronos/picks de bracket et faire avancer le vainqueur vers le
// tour suivant. Même limite technique que scripts/seed-playoffs-
// simulation.mjs : lib/scoring/recompute.ts et lib/scoring/advancement.ts
// importent getServiceClient (lib/supabase/service.ts, "server-only") —
// incompatible avec un script Node autonome, donc l'orchestration
// (lecture/écriture, PAS le calcul) est réimplémentée ici à l'identique,
// simplifiée : NBA_CUP n'a pas la branche best-of-7.
//
// Résolution des paris personnalisés : PAS déclenchée ici — le mapping
// entity_mappings existe déjà (posé par nba-cup-create-match.mjs), donc
// resolveCalculableBets() (appelée par /api/resolve-bets, cron quotidien
// 10h UTC) trouvera tout automatiquement dès que ce script aura mis le
// match en FINISHED. Pour un retour immédiat pendant l'alpha, ce script
// affiche la commande curl à lancer à la main.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { deriveSeriesOutcome, scoreMatchPrediction, scoreBracketPick } from "../lib/scoring/engine.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/nba-cup-reveal-match.mjs --match=<matchId>)"
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
const matchId = args.match;
if (!matchId) throw new Error("Usage : --match=<matchId>");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Orchestration réimplémentée à l'identique de lib/scoring/recompute.ts
//    et lib/scoring/advancement.ts (voir en-tête ci-dessus) ────────────────

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
    competitionRow?.type ?? "NBA_CUP"
  );

  await supabase
    .from("series")
    .update({
      official_status: derived.status,
      official_winner_team_id: derived.winnerTeamId,
      official_score_format: derived.scoreFormat,
    })
    .eq("id", seriesRow.id);

  await recomputeSeries(seriesRow.id);
  return seriesRow.id;
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
  if (!series || series.official_status !== "FINISHED") return null;
  if (!series.official_winner_team_id || !series.next_series_id || !series.next_series_slot) return null;
  const column = series.next_series_slot === 1 ? "team1_id" : "team2_id";
  const { data: nextSeries } = await supabase.from("series").select("team1_id, team2_id").eq("id", series.next_series_id).single();
  if (!nextSeries || nextSeries[column] !== null) return null;
  await supabase.from("series").update({ [column]: series.official_winner_team_id }).eq("id", series.next_series_id);
  return series.next_series_id;
}

// ── Script proprement dit ───────────────────────────────────────────────

async function main() {
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, series_id, status, home_team_id, away_team_id, scheduled_at")
    .eq("id", matchId)
    .single();
  if (matchError || !match) throw new Error(`Match introuvable : ${matchError?.message ?? matchId}`);
  if (match.status === "FINISHED") throw new Error("Ce match est déjà FINISHED — rien à faire.");

  const { data: mapping, error: mappingError } = await supabase
    .from("entity_mappings")
    .select("source_ref")
    .eq("entity_type", "MATCH")
    .eq("source_type", "NBA_API")
    .eq("internal_id", matchId)
    .maybeSingle();
  if (mappingError) throw new Error(`entity_mappings : ${mappingError.message}`);
  if (!mapping) throw new Error("Aucun vrai match lié (entity_mappings absent) — ce match n'a pas été créé via nba-cup-create-match.mjs ?");
  const realGameId = mapping.source_ref;

  const { data: appTeams, error: appTeamsError } = await supabase
    .from("teams")
    .select("id, abbreviation")
    .in("id", [match.home_team_id, match.away_team_id]);
  if (appTeamsError) throw new Error(`teams : ${appTeamsError.message}`);
  const abbrById = new Map((appTeams ?? []).map((t) => [t.id, t.abbreviation]));
  const homeAbbr = abbrById.get(match.home_team_id);
  const awayAbbr = abbrById.get(match.away_team_id);
  if (!homeAbbr || !awayAbbr) throw new Error("Équipe(s) introuvable(s) dans teams pour ce match.");

  const { data: statsTeams, error: statsTeamsError } = await supabase
    .from("stats_equipes")
    .select("team_id, tricode")
    .in("tricode", [homeAbbr, awayAbbr]);
  if (statsTeamsError) throw new Error(`stats_equipes : ${statsTeamsError.message}`);
  const nbaIdByTricode = new Map((statsTeams ?? []).map((t) => [t.tricode, t.team_id]));
  const homeNbaId = nbaIdByTricode.get(homeAbbr);
  const awayNbaId = nbaIdByTricode.get(awayAbbr);
  if (homeNbaId === undefined || awayNbaId === undefined) throw new Error(`Tricode(s) ${homeAbbr}/${awayAbbr} introuvable(s) dans stats_equipes.`);

  const { data: boxRows, error: boxError } = await supabase
    .from("stats_box_scores")
    .select("team_id, pts")
    .eq("game_id", realGameId)
    .in("team_id", [homeNbaId, awayNbaId]);
  if (boxError) throw new Error(`stats_box_scores : ${boxError.message}`);
  if (!boxRows || boxRows.length === 0) throw new Error(`Aucune stats_box_scores pour le match réel ${realGameId}.`);

  const scoreByTeam = new Map();
  for (const row of boxRows) {
    if (row.team_id === null || row.pts === null) continue;
    scoreByTeam.set(row.team_id, (scoreByTeam.get(row.team_id) ?? 0) + row.pts);
  }
  const homeScore = scoreByTeam.get(homeNbaId) ?? null;
  const awayScore = scoreByTeam.get(awayNbaId) ?? null;
  if (homeScore === null || awayScore === null) throw new Error("Score réel incomplet (une des 2 équipes n'a aucune ligne stats_box_scores).");

  const { error: updateError } = await supabase
    .from("matches")
    .update({ status: "FINISHED", home_score: homeScore, away_score: awayScore })
    .eq("id", matchId);
  if (updateError) throw new Error(`Mise à jour du match : ${updateError.message}`);

  console.log(`OK — match révélé : ${homeAbbr} ${homeScore} - ${awayScore} ${awayAbbr} (emprunté au vrai match ${realGameId}).`);

  const seriesId = await recomputeMatch(matchId);
  console.log("OK — pronos scorés, série mise à jour.");

  const nextSeriesId = await advanceWinnerIfDecided(seriesId);
  if (nextSeriesId) {
    await recomputeSeries(nextSeriesId);
    console.log(`OK — vainqueur avancé vers la série suivante (${nextSeriesId}), ses picks "affiche" re-scorés.`);
  } else {
    console.log("(série pas encore décidée, ou pas de série suivante — rien à avancer)");
  }

  console.log(
    "\nPour résoudre les paris personnalisés tout de suite plutôt que d'attendre le cron quotidien (10h UTC) :\n" +
      '  curl -X POST -H "Authorization: Bearer $SYNC_SECRET" https://nba-pronos.vercel.app/api/resolve-bets'
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
