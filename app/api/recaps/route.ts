import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runRecaps } from "@/lib/recaps/sendRecaps";

// Récaps du matin (p3-10) : push journalier, hebdo le lundi. Même garde
// d'authentification que /api/reminders/* (Bearer SYNC_SECRET, service_role)
// — déclenché par un cron Vercel (vercel.json, fiable) et par GitHub Actions (secours, souvent en retard de plusieurs heures). `?force=1` ignore la
// fenêtre 10h-13h (Paris), pour un déclenchement manuel ; la déduplication
// (recap_log) s'applique toujours. Exception : en compétition « Match du
// jour », rien n'est envoyé avant 10h même avec force (le match du jour n'est
// pas encore publié, voir runRecaps).
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const params = new URL(request.url).searchParams;
    const force = params.get("force") === "1";
    // `?only_owner=1` : push limité au compte du propriétaire (OWNER_USER_ID,
    // variable serveur), jamais à un identifiant passé en paramètre — même avec
    // le secret, ce mode ne peut que restreindre l'envoi.
    let onlyUserId: string | undefined;
    if (params.get("only_owner") === "1") {
      const owner = process.env.OWNER_USER_ID ?? "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) {
        return NextResponse.json({ error: "OWNER_USER_ID absent ou invalide." }, { status: 400 });
      }
      onlyUserId = owner;
    }
    const result = await runRecaps(Date.now(), { force, onlyUserId });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
