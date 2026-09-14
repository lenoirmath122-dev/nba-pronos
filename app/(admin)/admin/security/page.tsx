import { listMySessions } from "@/lib/actions/mfa";
import { SecurityScreen } from "@/components/admin/SecurityScreen";

// Sécurité du compte admin (p2-8, feuille de route Phase 2) : régénération
// des codes de récupération 2FA + visibilité sur les sessions actives.
// Atteignable seulement une fois déjà passé la garde 2FA de
// app/(admin)/admin/layout.tsx (comme toute autre page sous /admin).
export default async function AdminSecurityPage() {
  const result = await listMySessions();
  const sessions = result.success ? result.data : [];

  return <SecurityScreen sessions={sessions} />;
}
