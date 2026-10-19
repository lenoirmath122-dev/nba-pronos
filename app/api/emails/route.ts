import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/sync/auth";
import { runEmails, type EmailKind } from "@/lib/email/run";

// E-mails planifiés (1B). Crons Vercel (vercel.json) :
//  - `?kind=morning` à 8h, 9h et 10h UTC : résultat du matin puis relance, à
//    10h Paris (8h UTC en été, 9h en hiver, 10h UTC en rattrapage) ;
//  - `?kind=evening` à 16h, 17h et 18h UTC : rappel du soir à partir de 18h Paris.
// La déduplication (email_log, un e-mail par jour et par personne) rend les
// passages multiples sans danger. Manuel : `kind=result|relance|reminder`,
// `force=1` ignore la plage horaire, `dry_run=1` calcule sans envoyer ni
// journaliser, `only_owner=1` limite au compte du propriétaire (OWNER_USER_ID,
// jamais un identifiant passé en paramètre : le mode ne peut que restreindre).
// Garde d'authentification : Bearer SYNC_SECRET ou CRON_SECRET.
export const maxDuration = 300;
export const runtime = "nodejs";

const KINDS: Record<string, EmailKind[]> = {
  morning: ["RESULT", "RELANCE"],
  evening: ["REMINDER"],
  result: ["RESULT"],
  relance: ["RELANCE"],
  reminder: ["REMINDER"],
};

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const kinds = KINDS[params.get("kind") ?? ""];
  if (!kinds) return NextResponse.json({ error: "kind inconnu." }, { status: 400 });

  let onlyUserId: string | undefined;
  if (params.get("only_owner") === "1") {
    const owner = process.env.OWNER_USER_ID ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) {
      return NextResponse.json({ error: "OWNER_USER_ID absent ou invalide." }, { status: 400 });
    }
    onlyUserId = owner;
  }
  const options = { force: params.get("force") === "1", dryRun: params.get("dry_run") === "1", onlyUserId };

  // Chaque type est isolé : l'un qui plante ne bloque pas l'autre.
  const results: Record<string, unknown> = {};
  for (const kind of kinds) {
    results[kind] = await runEmails(kind, Date.now(), options).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "Erreur inconnue.",
    }));
  }
  const failed = Object.values(results).some((value) => typeof value === "object" && value !== null && "error" in value);
  return NextResponse.json(results, { status: failed ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;
