import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { VISITOR_COOKIE } from "@/lib/funnel/events";

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

  if (profile?.status === "PENDING") {
    if (profile.age_confirmed_at === null) {
      return NextResponse.redirect(new URL("/choisir-pseudo", request.url));
    }
    const { data: activated } = await service
      .from("users")
      .update({ status: "ACTIVE" })
      .eq("id", user.id)
      .eq("status", "PENDING")
      .select("id");
    // Entonnoir (§1.13) : le lien s'ouvre parfois dans un autre navigateur, sans le cookie.
    const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
    if (activated?.length && visitor) {
      await service.from("funnel_events").insert({ visitor_id: visitor, event: "account_validated" });
    }
  }

  return NextResponse.redirect(new URL("/bienvenue", request.url));
}
