import { NextResponse } from "next/server";

// Route de santé PUBLIQUE, sans authentification (B4, OPS-001) -- volontairement
// distincte de /api/heartbeat (Bearer SYNC_SECRET, service_role, ping DB
// anti-pause Supabase 1x/jour) : celle-ci n'a rien de privilégié à protéger,
// juste confirmer que le déploiement répond, pour un moniteur externe
// (UptimeRobot ou équivalent) appelé toutes les quelques minutes. Aucun
// accès Supabase ici -- pas la peine d'ajouter de la charge DB à chaque ping
// externe pour une simple vérification de disponibilité HTTP.
export const runtime = "nodejs";

function handle(): Response {
  return NextResponse.json({ ok: true });
}

export const GET = handle;
export const HEAD = handle;
