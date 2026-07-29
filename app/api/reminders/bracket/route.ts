import { NextResponse } from "next/server";
import { isAuthorizedSyncRequest } from "@/lib/sync/auth";
import { runBracketReminder } from "@/lib/reminders/bracketReminder";

// Rappel "la deadline du bracket approche" (backlog "Rappels ciblés").
// Même garde d'authentification que /api/sync/* (Bearer SYNC_SECRET,
// service_role) — déclenché par un planificateur GitHub Actions.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedSyncRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await runBracketReminder();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
