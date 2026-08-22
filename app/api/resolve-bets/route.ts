import { NextResponse } from "next/server";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { resolveCalculableBets } from "@/lib/ai/resolveCalculableBets";

// Phase 6 (résolution automatique des paris IA calculables, 22/08/2026) --
// même authentification que /api/sync/* (Bearer SYNC_SECRET, lib/sync/
// auth.ts, réutilisée telle quelle -- générique, pas spécifique à Highlightly
// malgré son nom de dossier). Runtime Node comme les autres routes sync
// (service_role, ne tourne jamais côté edge).
//
// Appelée en BOUT DE CHAÎNE du rafraîchissement quotidien Data NBA
// (.github/workflows/refresh-stats-supabase.yml) -- jamais sur le sync
// /api/sync/results (toutes les 30 min), qui ne fait que détecter qu'un
// match est FINISHED, sans les vraies stats de boîte à statistiques
// (stats_box_scores, rafraîchi une fois par jour seulement).
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const summary = await resolveCalculableBets();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
