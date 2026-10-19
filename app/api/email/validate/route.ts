import { NextResponse, type NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

// Bouton « Valider mon compte » de l'e-mail de relance (1B). Le lien magique
// Supabase expire en une heure, alors que l'e-mail est lu des heures plus tard :
// le bouton pointe ici (jeton signé, valable tant que le compte est en attente,
// donc 7 jours au plus) et on fabrique un lien magique tout neuf au clic, puis
// on passe la main à /auth/callback. Un compte déjà validé est renvoyé vers la
// connexion : un e-mail transféré ne doit pas ouvrir une session.
export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const failure = NextResponse.redirect(new URL("/login?lien=invalide", request.url));
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  const parsed = secret ? verifyUnsubscribeToken(request.nextUrl.searchParams.get("token") ?? "", secret) : null;
  if (!parsed || parsed.scope !== "validate") return failure;

  const service = getServiceClient();
  const { data: profile } = await service.from("users").select("status").eq("id", parsed.userId).maybeSingle<{ status: string }>();
  if (profile?.status !== "PENDING") return NextResponse.redirect(new URL("/login", request.url));

  const { data: authUser } = await service.auth.admin.getUserById(parsed.userId);
  const email = authUser.user?.email;
  if (!email) return failure;
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return failure;

  const target = new URL("/auth/callback", request.url);
  target.searchParams.set("token_hash", tokenHash);
  target.searchParams.set("type", "email");
  return NextResponse.redirect(target);
}
