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
// réseau) : LAISSE PASSER plutôt que de bloquer une action légitime pour
// une raison indépendante du joueur -- best-effort, même philosophie que
// le reste du pipeline non critique de ce dépôt (ex. notifyChatMessage).

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
  if (error) return true;
  return data === true;
}
