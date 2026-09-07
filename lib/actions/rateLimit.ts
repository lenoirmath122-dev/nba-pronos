import "server-only";
import type { getServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof getServerClient>>;

// Rate limiting applicatif de base (SEC-001 de l'audit du 03/09/2026, item
// A2 du plan d'action) -- fine couche au-dessus de la fonction SQL
// check_rate_limit() (migration 20260903150000), appelée via le client de
// SESSION (jamais service_role -- la fonction utilise auth.uid() en
// interne pour savoir qui limiter, résolu uniquement dans ce contexte).
//
// Panne du mécanisme lui-même (colonne/fonction pas encore migrée, erreur
// réseau) : BLOQUE par défaut (fail-closed, p1-13, feuille de route
// Phase 1) -- un rate-limit qui laisse passer sous panne n'en est plus un.
// Changé le 07/09/2026 : ce module protégeait jusqu'ici en fail-open, avec
// la même philosophie best-effort que le reste du pipeline non critique de
// ce dépôt (ex. notifyChatMessage) -- mais une panne SQL est justement le
// cas qu'un attaquant peut chercher à provoquer pour désactiver la
// protection. Compromis assumé : une vraie panne transitoire du mécanisme
// bloque aussi les joueurs légitimes (chat/paris/signalements) le temps
// qu'elle se résorbe, plutôt que de rouvrir la porte en silence.

/** `action` : identifiant court et stable (ex. "chat_message", "bet_submit",
 *  "bug_report") -- partagé entre tous les appelants du même type d'action,
 *  jamais dérivé dynamiquement (une chaîne par joueur ferait autant de
 *  compteurs distincts que de joueurs, cassant l'intention). */
export async function checkRateLimit(
  supabase: SupabaseServerClient,
  action: string,
  maxCount: number,
  windowSeconds: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_action: action,
    p_max_count: maxCount,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(`checkRateLimit(${action}) : RPC en échec, refus par défaut (fail-closed) — ${error.message}`);
    return false;
  }
  return data === true;
}
