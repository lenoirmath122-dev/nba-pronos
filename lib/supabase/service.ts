import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client SERVEUR PRIVILÉGIÉ (service_role, CONTOURNE la RLS). Réservé aux
// routes /api/sync/* + /api/heartbeat et au module d'écriture système
// déclenché par l'admin (T6a §2.4/§5). L'import "server-only" fait échouer
// la compilation si ce module est importé depuis un composant "use client" —
// matérialisation de P2 : impossible d'exposer service_role au navigateur.
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
