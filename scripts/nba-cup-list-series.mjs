#!/usr/bin/env node
// Lecture seule — liste la compétition NBA_CUP active et ses séries (avec
// noms d'équipe) pour retrouver les seriesId sans avoir à les copier depuis
// l'admin. Jetable, même famille que scripts/nba-cup-*.mjs.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Lancer avec : node --env-file=.env.local scripts/nba-cup-list-series.mjs");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: comps, error: compsError } = await supabase
    .from("competitions")
    .select("id, name, type, status")
    .eq("type", "NBA_CUP")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1);
  if (compsError) throw new Error(compsError.message);
  if (!comps || comps.length === 0) throw new Error("Aucune compétition NBA_CUP active trouvée.");
  const comp = comps[0];

  const { data: series, error: seriesError } = await supabase
    .from("series")
    .select("id, round, team1_id, team2_id, official_status")
    .eq("competition_id", comp.id)
    .order("round", { ascending: true });
  if (seriesError) throw new Error(seriesError.message);

  const teamIds = [...new Set(series.flatMap((s) => [s.team1_id, s.team2_id]).filter(Boolean))];
  const { data: teams, error: teamsError } = await supabase.from("teams").select("id, name, abbreviation").in("id", teamIds);
  if (teamsError) throw new Error(teamsError.message);
  const teamById = Object.fromEntries(teams.map((t) => [t.id, t]));

  console.log(`Compétition : ${comp.name} (${comp.id}), statut ${comp.status}\n`);
  for (const s of series) {
    const t1 = s.team1_id ? teamById[s.team1_id] : null;
    const t2 = s.team2_id ? teamById[s.team2_id] : null;
    console.log(
      `[${s.round}] série ${s.id} — ${t1 ? `${t1.name} (${t1.abbreviation})` : "?"} vs ${t2 ? `${t2.name} (${t2.abbreviation})` : "?"} — ${s.official_status}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("ÉCHEC :", err.message);
    process.exit(1);
  });
