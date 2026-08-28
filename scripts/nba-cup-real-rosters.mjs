#!/usr/bin/env node
// Lecture seule — pour un ou plusieurs game_id réels choisis comme base des
// quarts NBA Cup, liste les joueurs ayant RÉELLEMENT joué ce match (donc les
// seuls valables pour un pari perso/pronostic sur ce match fictif — un
// joueur absent de cette liste n'est pas dans le vrai roster de ce match,
// même s'il joue aujourd'hui pour l'équipe). Sert à préparer la fiche
// effectifs à donner aux testeurs de l'alpha.
//
// Usage : node --env-file=.env.local scripts/nba-cup-real-rosters.mjs \
//           --games=0022500320,0022400731,0022400936,0022400594

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Lancer avec : node --env-file=.env.local scripts/nba-cup-real-rosters.mjs --games=<id1,id2,...>");
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
const gameIds = (args.games ?? "").split(",").map((s) => s.trim()).filter(Boolean);
if (gameIds.length === 0) throw new Error("--games=<id1,id2,...> requis");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: matches, error: matchesError } = await supabase
    .from("stats_matchs")
    .select("game_id, game_date, home_team_id, away_team_id")
    .in("game_id", gameIds);
  if (matchesError) throw new Error(matchesError.message);

  const teamIds = [...new Set(matches.flatMap((m) => [m.home_team_id, m.away_team_id]))];
  const { data: teams, error: teamsError } = await supabase.from("stats_equipes").select("team_id, city, name, tricode").in("team_id", teamIds);
  if (teamsError) throw new Error(teamsError.message);
  const teamById = Object.fromEntries(teams.map((t) => [t.team_id, t]));

  for (const gameId of gameIds) {
    const match = matches.find((m) => m.game_id === gameId);
    if (!match) {
      console.log(`\n=== ${gameId} : introuvable dans stats_matchs ===`);
      continue;
    }
    const home = teamById[match.home_team_id];
    const away = teamById[match.away_team_id];

    const { data: rows, error: rowsError } = await supabase
      .from("stats_box_scores")
      .select("player_id, opponent_team_id, pts, reb, ast, minutes")
      .eq("game_id", gameId);
    if (rowsError) throw new Error(rowsError.message);

    const playerIds = rows.map((r) => r.player_id);
    const { data: players, error: playersError } = await supabase
      .from("stats_joueurs")
      .select("player_id, first_name, family_name")
      .in("player_id", playerIds);
    if (playersError) throw new Error(playersError.message);
    const playerById = Object.fromEntries(players.map((p) => [p.player_id, p]));

    console.log(`\n=== ${home.city} ${home.name} vs ${away.city} ${away.name} — ${match.game_date} (${gameId}) ===`);

    for (const team of [home, away]) {
      const teamRows = rows
        .filter((r) => r.opponent_team_id === (team === home ? away.team_id : home.team_id))
        .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
      console.log(`\n${team.city} ${team.name} (${teamRows.length} joueurs ayant joué) :`);
      for (const r of teamRows) {
        const p = playerById[r.player_id];
        console.log(`  - ${p.first_name} ${p.family_name} — ${r.pts ?? 0}pts ${r.reb ?? 0}reb ${r.ast ?? 0}pas (${r.minutes ?? "?"} min)`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
