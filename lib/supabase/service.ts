import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client SERVEUR PRIVILÉGIÉ (service_role, CONTOURNE la RLS). Réservé aux
// routes /api/sync/* + /api/heartbeat, au module d'écriture système déclenché
// par l'admin (T6a §2.4/§5), et — depuis le 27/08/2026 — à
// lib/push/notifyChatMessage.ts : calculer les DESTINATAIRES d'une
// notification push (endpoint/clés d'un AUTRE joueur, `push_subscriptions`,
// volontairement verrouillé à `user_id = auth.uid()` par RLS) est par nature
// un besoin privilégié, déclenché en direct par une Server Action joueur
// (postChatMessageFormAction) plutôt que par un cron comme les autres
// rappels (lib/reminders/*) -- même frontière de confiance, juste un
// déclencheur synchrone au lieu d'un planificateur. L'import "server-only"
// fait échouer la compilation si ce module est importé depuis un composant
// "use client" — matérialisation de P2 : impossible d'exposer service_role
// au navigateur.
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
