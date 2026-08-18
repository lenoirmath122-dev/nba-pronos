#!/usr/bin/env node
// Correctif ponctuel (18/08/2026) : les 2 scripts d'avancement de la
// compétition (advance-current-competition{,-2}.mjs) ont marqué plusieurs
// matchs FINISHED sans jamais retoucher leur `scheduled_at`, resté à sa
// valeur d'origine (souvent dans le futur — c'étaient les "prochains
// matchs" qu'on résolvait). Signalé par l'utilisateur : « nettoyer... pour
// qu'il n'y ait pas de matchs terminés alors qu'ils sont programmés dans le
// futur ». Corrige `scheduled_at` uniquement (jamais status/scores/pronos/
// paris/picks) — recule chaque match incohérent dans le passé, en
// préservant l'ordre chronologique interne à sa série (avant le prochain
// match SCHEDULED de la même série, après le match FINISHED précédent).

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

// matchId -> nouvelle date (vérifiées une par une contre l'ordre de la
// série avant d'écrire, cf. scripts/find-inconsistent-dates.mjs).
const FIXES = {
  "fbc3fe87-f741-40e8-864f-dd6e2d1eb9ad": hoursAgo(0.33), // GSW-HOU #3, après #2 (12:41), avant #4 (21/08)
  "6fb77daf-0a97-4f54-8607-d5ceb4edc55a": hoursAgo(72), // ATL-BOS #1
  "7349409d-1587-4200-b469-1c397499b069": hoursAgo(48), // ATL-BOS #2, après #1, avant #3 (21/08)
  "3125e081-7c59-4718-b179-eff304a7c950": hoursAgo(24), // LAC-LAL #1, avant #2 (22/08)
  "5a7daa3e-1c30-4aa9-add3-a9ada72135fc": hoursAgo(6), // DET-IND #5, après #4 (16/08), avant #6
  "97b82e9b-58bf-4ef6-acb5-a9ccdac4f4c0": hoursAgo(4), // DET-IND #6, après #5, avant #7 (23/08)
  "3b95c720-beca-4ce7-b1e2-bb0fc32e5264": hoursAgo(8), // DAL-DEN #4, après #3 (14/08), avant #5 (21/08)
};

for (const [matchId, newDate] of Object.entries(FIXES)) {
  const { data: before } = await supabase.from("matches").select("scheduled_at, status").eq("id", matchId).single();
  const { error } = await supabase.from("matches").update({ scheduled_at: newDate }).eq("id", matchId);
  if (error) {
    console.error(`ÉCHEC — ${matchId} :`, error.message);
    process.exit(1);
  }
  console.log(`OK — ${matchId} (${before.status}) : ${before.scheduled_at} -> ${newDate}`);
}

console.log("\nTerminé — aucun status/score/prono/pari/pick touché, uniquement scheduled_at.");
