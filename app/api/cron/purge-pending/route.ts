import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { getServiceClient } from "@/lib/supabase/service";

// Supprime les comptes PENDING (e-mail jamais validé) de plus de 7 jours, et les
// mesures d'entonnoir de plus de 25 mois (durée annoncée dans /confidentialite).
// Garde d'authentification : Bearer SYNC_SECRET ou CRON_SECRET (cron Vercel).
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data, error } = await service.rpc("purge_pending_users");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 25);
  await service.from("funnel_events").delete().lt("created_at", cutoff.toISOString());
  return NextResponse.json({ purged: data ?? 0 });
}

export const GET = handle;
export const POST = handle;
