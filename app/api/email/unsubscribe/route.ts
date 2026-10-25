import { getServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

// Désinscription en un clic, sans connexion (1B). GET n'écrit rien : les
// antivirus et clients mail préchargent les liens, une désinscription sur GET
// couperait des joueurs à leur insu. Le GET affiche un bouton, le POST agit
// (c'est aussi la requête que Gmail et Apple Mail envoient avec List-Unsubscribe-Post).
export const runtime = "nodejs";

const COLUMN = { results: "email_results_enabled", reminders: "email_reminders_enabled" } as const;
const LABEL = { results: "les e-mails de résultats et le récap hebdo", reminders: "les rappels du soir" } as const;

function page(body: string, status = 200): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Désinscription · Panier Ballon</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem;line-height:1.5">${body}</body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function parse(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  const parsed = secret ? verifyUnsubscribeToken(token, secret) : null;
  // Un jeton « validate » (bouton de la relance) ne désinscrit personne.
  return parsed && parsed.scope !== "validate" ? { userId: parsed.userId, scope: parsed.scope } : null;
}

export async function GET(request: Request): Promise<Response> {
  const parsed = parse(request);
  if (!parsed) return page("<p>Ce lien n'est pas valide.</p>", 400);
  return page(
    `<h1>Se désinscrire</h1><p>Tu ne recevras plus ${LABEL[parsed.scope]}.</p>` +
      `<form method="post"><button type="submit" style="padding:.75rem 1.25rem;font-size:1rem">Confirmer la désinscription</button></form>`
  );
}

export async function POST(request: Request): Promise<Response> {
  const parsed = parse(request);
  if (!parsed) return page("<p>Ce lien n'est pas valide.</p>", 400);
  const { error } = await getServiceClient()
    .from("users")
    .update({ [COLUMN[parsed.scope]]: false })
    .eq("id", parsed.userId);
  if (error) return page("<p>Une erreur est survenue, réessaie dans un instant.</p>", 500);
  return page(
    `<h1>C'est fait</h1><p>Tu ne recevras plus ${LABEL[parsed.scope]}. Tu peux les réactiver à tout moment depuis ton profil.</p>`
  );
}
