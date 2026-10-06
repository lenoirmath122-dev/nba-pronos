import { NextResponse } from "next/server";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { runRecaps } from "@/lib/recaps/sendRecaps";

// Récaps du matin (p3-10) : push journalier, hebdo le lundi. Même garde
// d'authentification que /api/reminders/* (Bearer SYNC_SECRET, service_role)
// — déclenché par un planificateur GitHub Actions. `?force=1` ignore la
// fenêtre 10h-13h (Paris), pour un déclenchement manuel ; la déduplication
// (recap_log) s'applique toujours. Exception : en compétition « Match du
// jour », rien n'est envoyé avant 10h même avec force (le match du jour n'est
// pas encore publié, voir runRecaps).
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    const result = await runRecaps(Date.now(), { force });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
