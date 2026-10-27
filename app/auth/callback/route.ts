import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { FUNNEL_VID_META, UTM_COOKIE, VISITOR_COOKIE, isValidVisitorId, parseUtmCookie } from "@/lib/funnel/events";
import { insertFunnelEvent, trackAccountCreated } from "@/lib/funnel/record";
import { detectInAppBrowser } from "@/lib/auth/inAppBrowser";

// Retour des liens de connexion (plan d'attractivité, §1.6) : lien magique reçu
// par e-mail et retour de Google. Deux formes :
//  - `token_hash` + `type` (modèle d'e-mail Supabase) : fonctionne même quand le
//    lien s'ouvre dans un autre navigateur que celui de l'inscription (cas
//    courant depuis Instagram) ;
//  - `code` (PKCE) : retour de Google, même navigateur.
// Un compte en attente devient ACTIVE ici, sauf s'il n'a pas encore déclaré son
// âge (arrivée par Google) : il passe d'abord par /choisir-pseudo.

function fail(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?lien=invalide", request.url));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const supabase = await getServerClient();

  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(request);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(request);
  } else {
    return fail(request);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(request);

  const service = getServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("status, age_confirmed_at")
    .eq("id", user.id)
    .maybeSingle<{ status: string; age_confirmed_at: string | null }>();

  const cookieStore = await cookies();
  // Entonnoir (§1.13) : le lien peut s'ouvrir dans un autre navigateur, sans le cookie ;
  // le visiteur gardé à la création du compte le remplace (puis est retiré des métadonnées).
  const metaVisitor = user.user_metadata?.[FUNNEL_VID_META];
  const cookieVisitor = cookieStore.get(VISITOR_COOKIE)?.value;
  const visitor = isValidVisitorId(cookieVisitor) ? cookieVisitor : isValidVisitorId(metaVisitor) ? metaVisitor : null;

  if (profile?.status === "PENDING") {
    if (profile.age_confirmed_at === null) {
      // Premier retour Google : le compte vient d'être créé (le pseudo se choisit ensuite).
      await trackAccountCreated();
      return NextResponse.redirect(new URL("/choisir-pseudo", request.url));
    }
    const { data: activated } = await service
      .from("users")
      .update({ status: "ACTIVE" })
      .eq("id", user.id)
      .eq("status", "PENDING")
      .select("id");
    if (activated?.length && visitor) {
      await insertFunnelEvent({
        visitorId: visitor,
        event: "account_validated",
        utm: parseUtmCookie(cookieStore.get(UTM_COOKIE)?.value),
        inAppBrowser: detectInAppBrowser(request.headers.get("user-agent")),
      });
    }
  }
  if (metaVisitor !== undefined) {
    await service.auth.admin.updateUserById(user.id, { user_metadata: { [FUNNEL_VID_META]: null } });
  }

  return NextResponse.redirect(new URL("/bienvenue", request.url));
}
