import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runMatchesReminder } from "@/lib/reminders/matchesReminder";

// Rappel "match du soir non pronostiqué" (backlog "Rappels ciblés").
// Garde d'authentification : Bearer SYNC_SECRET ou CRON_SECRET. Déclenché par
// les crons Vercel (vercel.json, fiables) et par GitHub Actions en secours
// (souvent en retard de plusieurs heures) ; reminder_log dédoublonne.
export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    const result = await runMatchesReminder();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
