import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Client SERVEUR en SESSION UTILISATEUR (composants serveur + server actions
// joueur/admin non privilégiées) : clé anon + JWT lu des cookies. La RLS
// s'applique (T6a §2.4).
//
// `cookies()` est asynchrone depuis Next.js 15/16 (AGENTS.md) : contrairement
// à la signature synchrone de T6a §2.4, cette fonction est donc async.
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
