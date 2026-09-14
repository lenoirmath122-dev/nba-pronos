import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";
import styles from "@/components/auth/MfaScreen.module.css";

// Étape de connexion admin après mot de passe (p2-8, feuille de route Phase
// 2) — route HORS de app/(admin)/admin/** exprès, même raison que
// /mfa-setup : admin/layout.tsx redirige ICI quand l'AAL de session est
// encore aal1, une page sous ce layout créerait une boucle.
export default async function MfaChallengePage() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/home");

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = factors?.all.some((f) => f.factor_type === "totp" && f.status === "verified");
  if (!hasVerifiedTotp) redirect("/mfa-setup");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/admin");

  return (
    <main className={styles.page}>
      <MfaChallengeForm />
    </main>
  );
}
