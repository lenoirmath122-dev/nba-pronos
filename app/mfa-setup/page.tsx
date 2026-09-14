import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { MfaSetupForm } from "@/components/auth/MfaSetupForm";
import styles from "@/components/auth/MfaScreen.module.css";

// Enrôlement 2FA obligatoire pour l'admin (p2-8, feuille de route Phase 2) —
// route HORS de app/(admin)/admin/** exprès : admin/layout.tsx redirige ICI
// tant qu'aucun facteur TOTP n'est vérifié, une page sous ce même layout
// créerait une redirection circulaire.
export default async function MfaSetupPage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/home");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = factors?.all.some((f) => f.factor_type === "totp" && f.status === "verified");
  if (hasVerifiedTotp) redirect("/admin/security");

  return (
    <main className={styles.page}>
      <MfaSetupForm />
    </main>
  );
}
