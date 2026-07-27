import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import styles from "./layout.module.css";

// Hub admin (T6a §3.1/§4.2) : garde de RÔLE, distincte de la garde de
// SESSION du proxy (qui protège déjà /admin/* en amont, redirect /login).
// Re-vérifiée à chaque navigation, jamais un état client mis en cache —
// même défense en profondeur que app/(app)/layout.tsx pour la session.
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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.tag}>admin</span>
        <h1 className={styles.title}>Administration</h1>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
