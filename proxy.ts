import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Garde d'AUTHENTIFICATION uniquement (a-t-on une session ?) — T6a §4.1.
// L'autorisation fine (rôle, statut) reste en base (RLS + is_admin(), T3),
// jamais ici : un contournement de ce fichier ne donne accès à aucune donnée.
//
// AGENTS.md / Next.js 16 : ce fichier remplace `middleware.ts` (renommé
// `proxy.ts`, export nommé `proxy` — comportement identique, cf. T6a §4.1
// correctif post-validation).

const APP_ZONE_PREFIXES = ["/home", "/play", "/profile"];
const ADMIN_ZONE_PREFIX = "/admin";
// Pages réservées aux visiteurs : un connecté est renvoyé vers /home. "/" est
// la page d'accueil publique (socle SEO, 05/10/2026).
const AUTH_PAGES = ["/", "/login", "/signup"];

// Cookie de session posé par @supabase/ssr : `sb-<ref>-auth-token`, éventuellement
// découpé en `.0`, `.1`… (le cookie PKCE `…-auth-token-code-verifier` matche aussi,
// volontairement : dans le doute on interroge Supabase).
function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Économie de CPU Vercel (alerte quota Fluid Active CPU du 05/11/2026) : un
  // visiteur sans cookie de session n'a rien à rafraîchir et getUser()
  // renverrait null de toute façon -- on saute la création du client et
  // l'appel Supabase Auth. Les redirections de zone restent appliquées.
  if (!hasSupabaseSessionCookie(request)) {
    return routeGuard(request, response, null);
  }

  // Client SERVEUR en session (T6a §2.4), lié aux cookies de la requête/réponse
  // du proxy — seul endroit où on manipule les cookies "à la main" (hors
  // getServerClient, réservé aux composants/server actions).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (pas getSession()) : revalidé auprès de Supabase Auth, ne fait
  // pas confiance à un cookie potentiellement périmé/forgé.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return routeGuard(request, response, user);
}

function routeGuard(
  request: NextRequest,
  response: NextResponse,
  user: unknown
): NextResponse {
  // Un appel de Server Action (header `next-action`, posé par le runtime
  // Next.js côté client) vers une page de zone protégée n'est PAS une
  // navigation -- une redirection ici renvoie une réponse HTTP que le
  // client interprète comme invalide pour une action ("An unexpected
  // response was received from the server"), affichant l'écran d'erreur
  // générique (app/error.tsx) au lieu du message géré par l'action elle-même
  // (chaque action de lib/actions/ vérifie déjà `auth.getUser()` et renvoie
  // `{success: false, error: "Tu dois être connecté."}` -- trouvé le
  // 09/09/2026 en écrivant T-ERR-02, feuille de route p1-4, sur une session
  // expirée en cours de soumission). Laisser passer ne retire AUCUNE
  // protection réelle : celle-ci vit dans l'action + RLS, jamais ici (cf.
  // commentaire d'en-tête de ce fichier).
  if (request.headers.get("next-action")) return response;

  const { pathname } = request.nextUrl;

  const isAppZone = APP_ZONE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isAdminZone =
    pathname === ADMIN_ZONE_PREFIX ||
    pathname.startsWith(`${ADMIN_ZONE_PREFIX}/`);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if ((isAppZone || isAdminZone) && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/play", request.url));
  }

  return response;
}

// Exclusions (économie de CPU, 05/11/2026) :
// - `api/` : crons Vercel + workflows GitHub (~150 appels/jour) authentifiés par
//   secret, jamais par session ; les deux routes en session (teams/insights,
//   account/export) passent par getServerClient, qui peut écrire les cookies
//   dans un route handler -- le rafraîchissement de session y reste assuré.
// - `_vercel/` : balises Web Analytics / Speed Insights envoyées à chaque page vue.
// - fichiers statiques (dont `sw.js`, polices, manifestes).
export const config = {
  matcher: [
    "/((?!api/|_vercel/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map|txt|xml|json|woff2?|ttf|mp4|webm)$).*)",
  ],
};
