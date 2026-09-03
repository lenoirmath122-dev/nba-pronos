#!/usr/bin/env node
// ============================================================================
// TEST — Robustesse du moteur de scoring sur l'archive playoffs 2026 (Excel)
// ============================================================================
// Fichier  : scripts/test-scoring-archive-playoffs.mjs
// Usage    : node --env-file=.env.local scripts/test-scoring-archive-playoffs.mjs
//
// Rejoue les VRAIS pronos (vainqueur + écart) de la compétition manuelle
// "NBA Pronos" d'avril-mai 2026 (Cadrage/DA/🏀 NBA Pronos - 22_04_2026
// (réponses) (1).xlsx, onglets MASTER_PRONOS + RÉSULTATS_RÉELS) à travers
// le VRAI moteur de scoring de l'app (lib/scoring/engine.ts::
// scoreMatchPrediction, fonction PURE, mêmes garanties que
// seed-playoffs-simulation.mjs). Objectif validé avec l'utilisateur
// (02-03/09/2026) : test de ROBUSTESSE sur des données réelles/bordéliques,
// PAS une comparaison chiffre-à-chiffre avec l'ancien barème du tableur
// (règles différentes, cf. GAPS_OUVERTS.md).
//
// LECTURE SEULE : aucune écriture en base, aucune modification de l'Excel.
//
// Prérequis : node scripts/extract-scoring-archive.mjs (ou l'équivalent
// Python déjà exécuté, cf. session) doit avoir produit master_pronos.json /
// resultats_reels.json -- chemins ARCHIVE_DIR ci-dessous.
//
// SOUCI IDENTIFIÉ AVANT LE LANCEMENT (demande explicite de l'utilisateur) :
// l'ancien tableur fait parier une TRANCHE d'écart ("11-15 pts"), le moteur
// actuel attend un NOMBRE précis (predictedMargin). Approche validée avec
// l'utilisateur (option "a") : chaque tranche est convertie en son POINT
// MÉDIAN (bracketMidpoint ci-dessous) -- approximation arbitraire, donc
// CHAQUE ligne du rapport garde marginApproximated=true ET la tranche
// d'origine, pour pouvoir exclure le détail écart du rapport si besoin sans
// tout relancer.

import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { scoreMatchPrediction } from "../lib/scoring/engine.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/test-scoring-archive-playoffs.mjs)"
  );
}

const ARCHIVE_DIR =
  "C:/Users/lenoi/AppData/Local/Temp/claude/c--dev-nba-pronos/fb0138cb-0d35-4dca-b658-d9a6870fa93a/scratchpad";

const masterPronos = JSON.parse(readFileSync(`${ARCHIVE_DIR}/master_pronos.json`, "utf-8"));
const resultatsReels = JSON.parse(readFileSync(`${ARCHIVE_DIR}/resultats_reels.json`, "utf-8"));

// ── Conversion tranche -> point médian (approximation, cf. commentaire d'en-tête) ──

function bracketMidpoint(ecart) {
  if (!ecart) return null;
  const s = String(ecart).trim();
  const exact = s.match(/^(\d+)\s*pts?$/i);
  if (exact) return Number(exact[1]);
  const range = s.match(/^(\d+)\s*-\s*(\d+)\s*pts?$/i);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const plus = s.match(/^(\d+)\s*\+\s*pts?$/i);
  if (plus) return Number(plus[1]) + 4; // "31+ pts" -> pas de borne haute, +4 arbitraire (cf. écart typique observé sur les tranches précédentes)
  return null;
}

// ── Mapping nom d'équipe (Excel) -> team id (Supabase, table teams) ──

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const { data: teams, error: teamsError } = await supabase.from("teams").select("id, name, abbreviation");
if (teamsError) throw new Error(`Lecture teams échouée : ${teamsError.message}`);

function normalize(s) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const teamsByName = new Map(teams.map((t) => [normalize(t.name), t]));

function findTeamId(rawName) {
  if (!rawName) return null;
  const needle = normalize(rawName);
  const exact = teamsByName.get(needle);
  if (exact) return exact.id;
  // repli : correspondance partielle (ex. "LA Lakers" vs "Los Angeles Lakers")
  const partial = teams.find((t) => normalize(t.name).includes(needle) || needle.includes(normalize(t.name)));
  return partial ? partial.id : null;
}

// ── Jointure MASTER_PRONOS <-> RÉSULTATS_RÉELS sur la clé "Match" ──

const resultsByMatch = new Map(resultatsReels.filter((r) => r["Date"] === "COMPLETED").map((r) => [r["ID Match"], r]));

const report = [];
const anomalies = [];

for (const bet of masterPronos) {
  const matchKey = bet["Match"];
  const pseudo = bet["Pseudo"];
  if (!matchKey || !pseudo) continue;

  const result = resultsByMatch.get(matchKey);
  if (!result) {
    anomalies.push({ type: "no_result", matchKey, pseudo });
    continue;
  }

  const predictedWinnerTeamId = findTeamId(bet["Vainqueur"]);
  const actualWinnerName = result["nom du vainqueur"];
  // Construction synthétique : "home" = vainqueur réel, "away" = perdant réel
  // (scoreMatchPrediction ne se sert de home/away que pour comparer les
  // scores et en déduire le vainqueur -- aucune notion réelle de domicile
  // nécessaire ici, cf. commentaire d'en-tête).
  const actualWinnerTeamId = findTeamId(actualWinnerName);
  if (!predictedWinnerTeamId || !actualWinnerTeamId) {
    anomalies.push({
      type: "team_not_found",
      matchKey,
      pseudo,
      predicted: bet["Vainqueur"],
      actual: actualWinnerName,
    });
    continue;
  }

  const ecartBracket = bet["Écart"];
  const predictedMargin = bracketMidpoint(ecartBracket);

  const prediction = {
    predictedWinnerTeamId,
    predictedMargin,
    isFrozen: true,
  };
  const match = {
    id: matchKey,
    status: "FINISHED",
    homeTeamId: actualWinnerTeamId,
    awayTeamId: "loser-placeholder", // jamais comparé à predictedWinnerTeamId, juste requis par le type
    homeScore: result["score du vainqueur"],
    awayScore: result["score du perdant"],
  };

  const score = scoreMatchPrediction(prediction, match);

  report.push({
    pseudo,
    matchKey,
    predictedWinner: bet["Vainqueur"],
    actualWinner: actualWinnerName,
    ecartBracketOriginal: ecartBracket,
    predictedMarginMidpoint: predictedMargin,
    marginApproximated: true,
    actualMarginReel: result["Écart Réel"],
    isWinnerCorrect: score.isWinnerCorrect,
    marginDiff: score.marginDiff,
    winnerPoints: score.winnerPoints,
    marginBonusPoints: score.marginBonusPoints,
  });
}

// ── Rapport ──

writeFileSync(`${ARCHIVE_DIR}/scoring_report.json`, JSON.stringify(report, null, 2), "utf-8");

const nulls = report.filter((r) => r.winnerPoints === null);
const winnerCorrect = report.filter((r) => r.isWinnerCorrect === true);
const winnerWrong = report.filter((r) => r.isWinnerCorrect === false);
const withMarginBonus = report.filter((r) => (r.marginBonusPoints ?? 0) > 0);

console.log(`=== Rapport de robustesse -- moteur de scoring vs archive réelle ===`);
console.log(`Pronos traités       : ${report.length} / ${masterPronos.length}`);
console.log(`Anomalies (ignorées) : ${anomalies.length}`);
console.log(`  - pas de résultat trouvé : ${anomalies.filter((a) => a.type === "no_result").length}`);
console.log(`  - équipe non résolue     : ${anomalies.filter((a) => a.type === "team_not_found").length}`);
console.log(`Scores NULL inattendus (isFrozen/predictedMargin manquant) : ${nulls.length}`);
console.log(`Vainqueur correct  : ${winnerCorrect.length} (${((winnerCorrect.length / report.length) * 100).toFixed(1)}%)`);
console.log(`Vainqueur incorrect: ${winnerWrong.length}`);
console.log(`Avec bonus d'écart (>0 pt, approximé)  : ${withMarginBonus.length}`);
console.log(`\nRapport complet écrit : ${ARCHIVE_DIR}/scoring_report.json`);
if (anomalies.length) {
  writeFileSync(`${ARCHIVE_DIR}/scoring_anomalies.json`, JSON.stringify(anomalies, null, 2), "utf-8");
  console.log(`Détail anomalies écrit : ${ARCHIVE_DIR}/scoring_anomalies.json`);
}
