import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runBracketReminder } from "@/lib/reminders/bracketReminder";

// Rappel "la deadline du bracket approche" (backlog "Rappels ciblés").
// Garde d'authentification : Bearer SYNC_SECRET ou CRON_SECRET. Déclenché par
// le cron Vercel (vercel.json) ; reminder_log dédoublonne.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
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
