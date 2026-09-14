import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import styles from "./layout.module.css";

// Hub admin (T6a §3.1/§4.2) : garde de RÔLE, distincte de la garde de
// SESSION du proxy (qui protège déjà /admin/* en amont, redirect /login).
// Re-vérifiée à chaque navigation, jamais un état client mis en cache —
// même défense en profondeur que app/(app)/layout.tsx pour la session.

// p1-24 (feuille de route Phase 1) : recalculateCompetition() (lib/actions/
// admin.ts, bouton « Recalculer ») rejoue TOUT le barème d'une compétition
// en boucles séquentielles (lib/scoring/recompute.ts::recomputeCompetition,
// délibérément sans grosse transaction ni parallélisation — voir le
// commentaire de ce module, compensé par l'idempotence) : sur une vraie
// compétition remplie (tous les matchs + tous les picks de bracket + tous
// les paris), le nombre d'allers-retours réseau séquentiels peut dépasser
// la durée par défaut d'une Server Action Vercel avant d'avoir fini, sans
// que la case "action admin rare" ne le rende improbable pour autant.
// Étendue ici (route segment config, couvre toutes les Server Actions
// appelées depuis une page sous ce layout) à 60s — valeur sûre quel que
// soit le palier Vercel, pas une estimation précise du vrai besoin.
// Rejouable sans risque si jamais atteinte malgré tout (idempotence déjà
// garantie par conception).
export const maxDuration = 60;

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // is_admin() lit users.role en base (RPC SECURITY DEFINER, T3) — jamais un
  // claim JWT, pour qu'une promotion soit effective sans re-login.
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    // Pas de fuite d'existence d'écran (T6a §4.2) : même redirection que
    // pour un visiteur non connecté sur une route joueur.
    redirect("/home");
  }

  // 2FA obligatoire pour l'admin (p2-8, feuille de route Phase 2) — un mot
  // de passe seul protège aujourd'hui le compte qui a accès à toutes les
  // données du jeu. Pas encore de facteur TOTP vérifié => on force
  // l'enrôlement avant de laisser passer, pas juste une option proposée.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedTotp = factors?.all.some((f) => f.factor_type === "totp" && f.status === "verified");
  if (!hasVerifiedTotp) {
    redirect("/mfa-setup");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") {
    // Repli codes de récupération (téléphone perdu) : l'AAL Supabase reste
    // aal1 dans ce cas, donc on accepte aussi une session de secours posée
    // par verifyRecoveryCode() (lib/actions/mfa.ts) — jamais permanente
    // (30 min, vérifiée en base à chaque requête, pas juste un cookie lu
    // tel quel).
    const cookieStore = await cookies();
    const recoveryCookie = cookieStore.get("admin_recovery_session")?.value;
    const { data: recoveryValid } = recoveryCookie
      ? await supabase.rpc("check_admin_recovery_session", { p_session_id: recoveryCookie })
      : { data: false };
    if (!recoveryValid) {
      redirect("/mfa-challenge");
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.tag}>admin</span>
        <h1 className={styles.title}>Administration</h1>
        {/* Remonté par l'utilisateur en testant (30/07/2026) : aucun moyen de
            sortir du panneau admin vers l'app joueur depuis sa création
            (§2.20). Lien partagé, présent sur TOUTES les pages admin. */}
        <Link href="/home" className={styles.exitLink}>
          ← Retour à l&apos;app
        </Link>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
