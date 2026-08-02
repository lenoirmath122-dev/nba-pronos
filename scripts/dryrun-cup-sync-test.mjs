#!/usr/bin/env node
// ============================================================================
// DRY-RUN JETABLE — vérifier en conditions réelles que la synchro Highlightly
// (schedule + results) fonctionne pour une série NBA Cup (1 seul match par
// série, contrairement aux Playoffs) : import automatique du match dès qu'il
// tombe dans la fenêtre, score synchronisé, série FINISHED, vainqueur propagé
// vers le tour suivant.
//
// SCRIPT JETABLE — à supprimer après usage, jamais committé (même patron que
// les dry-runs précédents, ETAT_ACTUEL.md §2.30/§2.34).
//
// PRÉCAUTION : ce script touche la VRAIE compétition ACTIVE (archivage
// TEMPORAIRE le temps du test, restaurée par `teardown`). Ne PAS lancer
// `setup` sans enchaîner sur `teardown` derrière — sinon la vraie
// compétition ("Test") reste archivée et invisible pour les joueurs.
//
// USAGE (dans un terminal, à la racine du projet) :
//
//   1. node --env-file=.env.local scripts/dryrun-cup-sync-test.mjs setup
//      -> archive temporairement la compétition ACTIVE réelle, crée une
//         compétition NBA Cup de test isolée (7 séries : 4 quarts, dont
//         NYK-TOR et MIA-ORL — 2 VRAIS matchs joués le 09/12/2025 ; les 2
//         autres quarts BOS-PHI/DEN-LAL sont des placeholders jamais
//         synchronisés dans ce test). Note bien le competitionId affiché.
//
//   2. Dans un AUTRE terminal : npm run build && npm run start
//      (sert l'app sur http://localhost:3000, connectée à la MÊME base
//      Supabase que la prod — même patron que le dry-run Playoffs du
//      28/07/2026).
//
//   3. Appeler les 2 routes de synchro avec le VRAI SYNC_SECRET (celui posé
//      comme secret GitHub Actions / dans .env.local) et la VRAIE date où
//      NYK-TOR et MIA-ORL ont été joués (fenêtre America/New_York) :
//
//        curl -X POST -H "Authorization: Bearer VOTRE_SYNC_SECRET" \
//          "http://localhost:3000/api/sync/schedule?date=2025-12-09"
//
//        curl -X POST -H "Authorization: Bearer VOTRE_SYNC_SECRET" \
//          "http://localhost:3000/api/sync/results?date=2025-12-09"
//
//      Attendu schedule : 2 créés (NYK-TOR, MIA-ORL), le reste ignoré/rien.
//      Attendu results  : 2 changés, scores réels, statut FINISHED.
//
//   4. node --env-file=.env.local scripts/dryrun-cup-sync-test.mjs verify <competitionId>
//      -> affiche l'état des 7 séries + matchs : vérifie que les 2 séries de
//         quarts synchronisées sont FINISHED avec un vainqueur, ET que ce
//         vainqueur a bien été propagé dans team1_id/team2_id de la demi-
//         finale (CUP_SEMIS slot 0) — c'est le point non encore prouvé
//         (agrégat de série à 1 seul match, jamais exercé via la vraie
//         synchro jusqu'ici).
//
//   5. node --env-file=.env.local scripts/dryrun-cup-sync-test.mjs teardown <competitionId>
//      -> supprime la compétition de test (matchs, séries, secret,
//         mappings), PUIS restaure la vraie compétition en ACTIVE. Vérifie
//         après coup qu'elle est bien réactive.
//
// À TOUT MOMENT si quelque chose tourne mal : `teardown <competitionId>`
// restaure quand même la vraie compétition (il lit qui était actif juste
// avant `setup` depuis la table, pas besoin de le repasser en argument).
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants — lance avec --env-file=.env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ABBREVS = ["NYK", "TOR", "MIA", "ORL", "BOS", "PHI", "DEN", "LAL"];
const QUARTER_MATCHUPS = [
  ["NYK", "TOR"], // vrai match Dec 9 2025 (NY @ TOR, Highlightly id 1438164)
  ["MIA", "ORL"], // vrai match Dec 9 2025 (MIA @ ORL, Highlightly id 664076)
  ["BOS", "PHI"], // placeholder, jamais synchronisé dans ce test
  ["DEN", "LAL"], // placeholder, jamais synchronisé dans ce test
];

async function cmdSetup() {
  const { data: teams, error: teamsErr } = await supabase.from("teams").select("id, abbreviation").in("abbreviation", ABBREVS);
  if (teamsErr) throw teamsErr;
  const idByAbbrev = new Map(teams.map((t) => [t.abbreviation, t.id]));
  for (const a of ABBREVS) if (!idByAbbrev.get(a)) throw new Error(`Équipe introuvable en base : ${a}`);

  const { data: realActive, error: realActiveErr } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (realActiveErr) throw realActiveErr;
  if (!realActive) {
    console.log("Aucune compétition ACTIVE actuellement — rien à protéger, on continue directement.");
  } else {
    const { error } = await supabase.from("competitions").update({ status: "ARCHIVED" }).eq("id", realActive.id);
    if (error) throw error;
    console.log(`Compétition réelle "${realActive.name}" (${realActive.id}) archivée TEMPORAIREMENT.`);
    console.log(`>>> Note bien cet id pour le teardown si besoin : ${realActive.id}`);
  }

  const { data: comp, error: compErr } = await supabase
    .from("competitions")
    .insert({ name: "DRYRUN Cup sync (jetable)", type: "NBA_CUP", status: "ACTIVE", bracket_deadline: null })
    .select("id")
    .single();
  if (compErr) throw compErr;

  const { error: secretErr } = await supabase
    .from("competition_secrets")
    .insert({ competition_id: comp.id, join_code: "DRYRUN01" });
  if (secretErr) throw secretErr;

  const insertSeries = async (rows) => {
    const { data, error } = await supabase.from("series").insert(rows).select("id");
    if (error) throw error;
    return data;
  };

  const [finalRow] = await insertSeries([{ competition_id: comp.id, round: "CUP_FINAL", conference: null, slot_index: 0 }]);
  const [semi0, semi1] = await insertSeries([
    { competition_id: comp.id, round: "CUP_SEMIS", conference: null, slot_index: 0, next_series_id: finalRow.id, next_series_slot: 1 },
    { competition_id: comp.id, round: "CUP_SEMIS", conference: null, slot_index: 1, next_series_id: finalRow.id, next_series_slot: 2 },
  ]);
  const semisBySlot = [semi0, semi0, semi1, semi1];
  const nextSlotBySlot = [1, 2, 1, 2];
  await insertSeries(
    QUARTER_MATCHUPS.map((m, i) => ({
      competition_id: comp.id,
      round: "CUP_QUARTERS",
      conference: null,
      slot_index: i,
      team1_id: idByAbbrev.get(m[0]),
      team2_id: idByAbbrev.get(m[1]),
      next_series_id: semisBySlot[i].id,
      next_series_slot: nextSlotBySlot[i],
    }))
  );

  console.log("\n=== SETUP OK ===");
  console.log("competitionId :", comp.id);
  console.log("\nProchaine étape : démarre le serveur (npm run build && npm run start) puis appelle");
  console.log(`  /api/sync/schedule?date=2025-12-09  et  /api/sync/results?date=2025-12-09`);
  console.log("avec le Bearer SYNC_SECRET (voir l'en-tête du script pour les commandes curl).");
}

async function cmdVerify(competitionId) {
  if (!competitionId) throw new Error("Usage : verify <competitionId>");
  const { data: series, error } = await supabase
    .from("series")
    .select("id, round, slot_index, team1_id, team2_id, official_status, official_winner_team_id")
    .eq("competition_id", competitionId)
    .order("round")
    .order("slot_index");
  if (error) throw error;

  const teamIds = [...new Set(series.flatMap((s) => [s.team1_id, s.team2_id, s.official_winner_team_id]).filter(Boolean))];
  const { data: teams } = await supabase.from("teams").select("id, abbreviation").in("id", teamIds);
  const abbrevById = new Map((teams ?? []).map((t) => [t.id, t.abbreviation]));

  const { data: matches } = await supabase
    .from("matches")
    .select("id, series_id, status, home_score, away_score, home_team_id, away_team_id")
    .eq("competition_id", competitionId);

  console.log("\n=== ÉTAT DES SÉRIES ===");
  for (const s of series) {
    const t1 = s.team1_id ? abbrevById.get(s.team1_id) : "—";
    const t2 = s.team2_id ? abbrevById.get(s.team2_id) : "—";
    const winner = s.official_winner_team_id ? abbrevById.get(s.official_winner_team_id) : "—";
    const seriesMatches = (matches ?? []).filter((m) => m.series_id === s.id);
    console.log(`${s.round} #${s.slot_index} : ${t1} vs ${t2} — statut=${s.official_status} vainqueur=${winner}`);
    for (const m of seriesMatches) {
      console.log(`    match : ${abbrevById.get(m.away_team_id) ?? "?"} @ ${abbrevById.get(m.home_team_id) ?? "?"} — ${m.status} — ${m.away_score ?? "?"}-${m.home_score ?? "?"}`);
    }
  }

  const semi0 = series.find((s) => s.round === "CUP_SEMIS" && s.slot_index === 0);
  console.log("\n=== VÉRIFICATION CLÉ ===");
  if (semi0 && semi0.team1_id && semi0.team2_id) {
    console.log("✅ Propagation OK : la demi-finale #0 a bien ses 2 équipes remplies automatiquement.");
  } else {
    console.log("⏳ Pas encore propagé (normal si les 2 quarts NYK-TOR/MIA-ORL ne sont pas encore FINISHED — relance schedule/results d'abord).");
  }
}

// Ajoute un match "à venir" (scheduled_at = maintenant + 2 jours, status
// SCHEDULED) sur la série de quarts BOS-PHI (jamais synchronisée dans ce
// test) — PAS un vrai match Highlightly, juste une donnée manuelle pour
// vérifier l'affichage joueur (Hub Jouer /play, Accueil /home), même patron
// que le décalage de dates déjà fait pour le dry-run Playoffs (ETAT_ACTUEL.md
// §2.34) : un vrai match Cup de déc. 2025 est toujours dans le PASSÉ par
// rapport à "aujourd'hui" réel, donc jamais affiché comme pronostiquable
// sans ce décalage manuel.
async function cmdSimulateUpcoming(competitionId) {
  if (!competitionId) throw new Error("Usage : simulate-upcoming <competitionId>");

  const { data: series, error } = await supabase
    .from("series")
    .select("id, round, slot_index, team1_id, team2_id")
    .eq("competition_id", competitionId)
    .eq("round", "CUP_QUARTERS")
    .eq("slot_index", 2)
    .single();
  if (error) throw error;
  if (!series.team1_id || !series.team2_id) throw new Error("Série BOS-PHI introuvable ou incomplète.");

  const { data: existingMatches } = await supabase.from("matches").select("id").eq("series_id", series.id);
  if ((existingMatches ?? []).length > 0) {
    console.log("Un match existe déjà pour cette série — rien à faire.");
    return;
  }

  const scheduledAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: match, error: insertErr } = await supabase
    .from("matches")
    .insert({
      competition_id: competitionId,
      series_id: series.id,
      game_number: 1,
      scheduled_at: scheduledAt,
      status: "SCHEDULED",
      home_team_id: series.team1_id,
      away_team_id: series.team2_id,
    })
    .select("id")
    .single();
  if (insertErr) throw insertErr;

  console.log(`Match "à venir" créé (id ${match.id}), scheduled_at = ${scheduledAt} (dans ~2 jours).`);
  console.log("Va vérifier dans ton navigateur (/play et /home, connecté à un compte joueur) qu'il apparaît");
  console.log("bien comme pronostiquable — la compétition ACTIVE actuelle est la compétition de test Cup,");
  console.log("pas ta vraie compétition (elle est archivée temporairement le temps du test).");
}

async function cmdTeardown(competitionId) {
  if (!competitionId) throw new Error("Usage : teardown <competitionId>");

  // Ordre respectant les FK (feuilles vers racine) — trouvé à l'usage
  // (31/07/2026) : si un vrai joueur consulte /play/bracket ou /play/bets
  // PENDANT le test, des lignes bets/brackets/bracket_picks réelles se
  // créent sur la compétition de test et bloquent la suppression de
  // `series`/`competitions` (FK sans cascade). Toutes les erreurs sont
  // maintenant vérifiées explicitement (silencieuses avant ce correctif —
  // c'est ce qui avait laissé "Test" archivée plus longtemps que prévu).
  const { data: matches } = await supabase.from("matches").select("id").eq("competition_id", competitionId);
  const matchIds = (matches ?? []).map((m) => m.id);
  if (matchIds.length > 0) {
    const { error: predErr } = await supabase.from("match_predictions").delete().in("match_id", matchIds);
    if (predErr) throw new Error(`delete match_predictions: ${predErr.message}`);
    const { error: mapErr } = await supabase.from("entity_mappings").delete().eq("entity_type", "MATCH").in("internal_id", matchIds);
    if (mapErr) throw new Error(`delete entity_mappings: ${mapErr.message}`);
    const { error: matchErr } = await supabase.from("matches").delete().in("id", matchIds);
    if (matchErr) throw new Error(`delete matches: ${matchErr.message}`);
  }

  const cleanupSteps = ["bets", "bracket_picks", "brackets", "series", "competition_secrets"];
  for (const table of cleanupSteps) {
    const { error } = await supabase.from(table).delete().eq("competition_id", competitionId);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
  }

  const { error: compErr } = await supabase.from("competitions").delete().eq("id", competitionId);
  if (compErr) throw new Error(`delete competitions: ${compErr.message}`);
  console.log(`Compétition de test ${competitionId} et toutes ses données supprimées.`);

  const { data: mostRecentArchived } = await supabase
    .from("competitions")
    .select("id, name")
    .eq("status", "ARCHIVED")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (mostRecentArchived) {
    const { error } = await supabase.from("competitions").update({ status: "ACTIVE" }).eq("id", mostRecentArchived.id);
    if (error) throw error;
    console.log(`Compétition réelle "${mostRecentArchived.name}" (${mostRecentArchived.id}) restaurée en ACTIVE.`);
  } else {
    console.log("⚠️  Aucune compétition archivée sans archived_at trouvée à restaurer automatiquement — vérifie manuellement l'état de ta compétition réelle (elle doit être ACTIVE).");
  }

  const { data: finalCheck } = await supabase.from("competitions").select("id, name, status").eq("status", "ACTIVE");
  console.log("\nCompétition(s) ACTIVE après teardown :", finalCheck);
}

async function main() {
  const [, , cmd, arg] = process.argv;
  if (cmd === "setup") await cmdSetup();
  else if (cmd === "verify") await cmdVerify(arg);
  else if (cmd === "simulate-upcoming") await cmdSimulateUpcoming(arg);
  else if (cmd === "teardown") await cmdTeardown(arg);
  else {
    console.log("Usage : node --env-file=.env.local scripts/dryrun-cup-sync-test.mjs <setup|verify|simulate-upcoming|teardown> [competitionId]");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("ERREUR :", err.message ?? err);
  process.exit(1);
});
