import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Client SERVEUR en SESSION UTILISATEUR (composants serveur + server actions
// joueur/admin non privilégiées) : clé anon + JWT lu des cookies. La RLS
// s'applique (T6a §2.4).
//
// `cookies()` est asynchrone depuis Next.js 15/16 (AGENTS.md) : contrairement
// à la signature synchrone de T6a §2.4, cette fonction est donc async.
//
// Compromis `httpOnly` accepté tel quel (audit de sécurité, finding 10,
// security-audit-report.md §1) : @supabase/ssr pose ces cookies avec
// `httpOnly: false` par défaut (aucune `cookieOptions` explicite ici ni
// dans proxy.ts/browser.ts) -- nécessaire pour que le client navigateur
// s'authentifie auprès de Supabase Realtime, qui lit le JWT côté client.
// Le filet de sécurité est la CSP stricte de `next.config.ts` (finding 7,
// traité) plutôt que HttpOnly : en l'absence de `dangerouslySetInnerHTML`
// dans tout le dépôt (vérifié par l'audit) et avec cette CSP, le risque
// XSS qui rendrait ce compromis exploitable n'a pas de vecteur connu à ce
// jour. À revisiter uniquement si Realtime cesse un jour de nécessiter un
// JWT lisible côté client.
export async function getServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un composant serveur (lecture seule, écriture de
            // cookie interdite pendant le rendu) : le rafraîchissement de
            // session est déjà assuré par proxy.ts (T6a §4.1).
          }
        },
      },
    }
  );
}
