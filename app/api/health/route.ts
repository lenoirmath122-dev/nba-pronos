import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Route de santé PUBLIQUE, sans authentification (B4, OPS-001) -- volontairement
// distincte de /api/heartbeat (Bearer SYNC_SECRET, service_role, ping DB
// anti-pause Supabase 1x/jour) : celle-ci n'a rien de privilégié à protéger,
// juste confirmer que le déploiement répond, pour un moniteur externe
// (UptimeRobot ou équivalent) appelé toutes les quelques minutes.
//
// Durci le 07/09/2026 (GAPS_OUVERTS.md, Phase 0) : ne renvoyait jusqu'ici que
// `{ ok: true }` sans jamais vérifier quoi que ce soit -- un Vercel qui répond
// mais dont Supabase ou le service Cloud Run seraient en panne serait passé
// pour "en bonne santé". Client anon (pas service_role -- ce ping n'a besoin
// d'aucun privilège), requête la plus légère possible (`head: true`, aucune
// ligne renvoyée) sur `teams`, table publique (`users_select`-like RLS).
// Cloud Run vérifié via son propre `/health` (Cadrage/Stats/service/app.py),
// public par construction. Statut HTTP 503 si un des deux est en panne --
// c'est ce qui fait réellement déclencher une alerte côté moniteur externe,
// un simple champ JSON ignoré par la plupart d'entre eux ne suffirait pas.
export const runtime = "nodejs";

async function checkSupabase(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;

  try {
    const supabase = createClient(url, anonKey);
    const { error } = await supabase.from("teams").select("id", { count: "exact", head: true });
    return !error;
  } catch {
    return false;
  }
}

async function checkStatsService(): Promise<boolean> {
  const url = process.env.STATS_SERVICE_URL;
  // Non configuré (ex. en local) : ne fait pas échouer le check global, ce
  // n'est pas une dépendance requise pour que le reste de l'app fonctionne.
  if (!url) return true;

  try {
    // Même délai que lib/ai/statsService.ts::callPredict -- Cloud Run peut se
    // réveiller depuis zéro (scale à zéro) ; un timeout trop court ferait
    // remonter une fausse alerte à chaque ping qui tombe juste après une
    // période creuse (constaté en local : 8s insuffisant sur un cold start,
    // 200 OK une fois le service chaud).
    const res = await fetch(`${url.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(20_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function handle(): Promise<Response> {
  const [supabaseOk, statsServiceOk] = await Promise.all([checkSupabase(), checkStatsService()]);
  const ok = supabaseOk && statsServiceOk;

  return NextResponse.json({ ok, supabase: supabaseOk, statsService: statsServiceOk }, { status: ok ? 200 : 503 });
}

export const GET = handle;
export const HEAD = handle;
