#!/usr/bin/env node
// ============================================================================
// NBA CUP ALPHA — (a) Recherche d'un vrai match historique entre 2 équipes
// ============================================================================
// Fichier  : scripts/nba-cup-find-real-game.mjs
// Usage    : node --env-file=.env.local scripts/nba-cup-find-real-game.mjs --home=BOS --away=NYK [--season=2024-25]
//
// Contexte : compétition NBA_CUP fictive pour l'alpha potes (~20-22/09/2026,
// voir Cadrage/Suivi/GAPS_OUVERTS.md). Chaque match fictif emprunte le score
// ET les stats joueur d'un VRAI match NBA historique déjà en base (stats_*),
// pour que les paris personnalisés IA se résolvent avec de vraies données
// plutôt qu'un score inventé de toutes pièces.
//
// Lecture SEULE (aucune écriture) — rejouable à volonté pour comparer
// plusieurs candidats avant de choisir avec scripts/nba-cup-create-match.mjs.
//
// Pont équipes app (teams.abbreviation) <-> stats NBA (stats_equipes.tricode) :
// même jointure texte que resolveNbaGameId()/resolveNbaTeamId()
// (lib/ai/resolveCalculableBets.ts) — pas de table de correspondance dédiée.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être chargées " +
      "(lancer avec : node --env-file=.env.local scripts/nba-cup-find-real-game.mjs --home=XXX --away=YYY)"
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
const homeAbbr = (args.home ?? "").toUpperCase();
const awayAbbr = (args.away ?? "").toUpperCase();
const seasonFilter = args.season ?? null;

if (!homeAbbr || !awayAbbr) {
  throw new Error("Usage : --home=<tricode> --away=<tricode> [--season=2024-25]");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: statsTeams, error: teamsError } = await supabase
    .from("stats_equipes")
    .select("team_id, tricode, city, name")
    .in("tricode", [homeAbbr, awayAbbr]);
  if (teamsError) throw new Error(`stats_equipes : ${teamsError.message}`);

  const teamByTricode = new Map((statsTeams ?? []).map((t) => [t.tricode, t]));
  const homeTeam = teamByTricode.get(homeAbbr);
  const awayTeam = teamByTricode.get(awayAbbr);
  if (!homeTeam || !awayTeam) {
    const missing = [homeAbbr, awayAbbr].filter((a) => !teamByTricode.has(a));
    throw new Error(`Tricode(s) introuvable(s) dans stats_equipes : ${missing.join(", ")}`);
  }

  let query = supabase
    .from("stats_matchs")
    .select("game_id, game_date, season, season_type")
    .or(
      `and(home_team_id.eq.${homeTeam.team_id},away_team_id.eq.${awayTeam.team_id}),` +
        `and(home_team_id.eq.${awayTeam.team_id},away_team_id.eq.${homeTeam.team_id})`
    )
    .order("game_date", { ascending: false });
  if (seasonFilter) query = query.eq("season", seasonFilter);

  const { data: games, error: gamesError } = await query;
  if (gamesError) throw new Error(`stats_matchs : ${gamesError.message}`);
  if (!games || games.length === 0) {
    console.log(`Aucun vrai match trouvé entre ${homeAbbr} et ${awayAbbr}${seasonFilter ? ` (saison ${seasonFilter})` : ""}.`);
    return;
  }

  console.log(`\n${games.length} match(s) réel(s) trouvé(s) entre ${homeTeam.city} ${homeTeam.name} et ${awayTeam.city} ${awayTeam.name} :\n`);

  for (const game of games) {
    const { data: boxRows, error: boxError } = await supabase
      .from("stats_box_scores")
      .select("player_id, team_id, pts")
      .eq("game_id", game.game_id);
    if (boxError) {
      console.log(`  [${game.game_id}] ${game.game_date} (${game.season}) — erreur stats_box_scores : ${boxError.message}`);
      continue;
    }
    if (!boxRows || boxRows.length === 0) {
      console.log(`  [${game.game_id}] ${game.game_date} (${game.season}) — PAS de stats_box_scores (à écarter, résolution des paris impossible)`);
      continue;
    }

    const scoreByTeam = new Map();
    for (const row of boxRows) {
      if (row.team_id === null || row.pts === null) continue;
      scoreByTeam.set(row.team_id, (scoreByTeam.get(row.team_id) ?? 0) + row.pts);
    }
    const homeScore = scoreByTeam.get(homeTeam.team_id) ?? null;
    const awayScore = scoreByTeam.get(awayTeam.team_id) ?? null;

    const playerIds = [...new Set(boxRows.map((r) => r.player_id))];
    const { data: players } = await supabase.from("stats_joueurs").select("player_id, first_name, family_name").in("player_id", playerIds);
    const nameById = new Map((players ?? []).map((p) => [p.player_id, `${p.first_name} ${p.family_name}`]));

    const top3 = [...boxRows]
      .filter((r) => r.pts !== null)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 3)
      .map((r) => `${nameById.get(r.player_id) ?? `#${r.player_id}`} ${r.pts}pts`)
      .join(", ");

    console.log(
      `  [${game.game_id}] ${game.game_date} (${game.season}${game.season_type ? `, ${game.season_type}` : ""}) — ` +
        `${homeAbbr} ${homeScore ?? "?"} - ${awayScore ?? "?"} ${awayAbbr} — Top scoreurs : ${top3}`
    );
  }

  console.log(
    `\nChoisis un game_id ci-dessus, puis :\n` +
      `  node --env-file=.env.local scripts/nba-cup-create-match.mjs --series=<seriesId> --game=<game_id> --at="2026-09-20T20:00"\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
