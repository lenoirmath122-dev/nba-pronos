import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/nav/TabBar";
import { UnsavedGuardProvider } from "@/lib/hooks/useUnsavedGuard";
import { logout } from "@/lib/auth/actions";
import styles from "./layout.module.css";

// Zone joueur connecté (T6a §3.1) : garde de session + nav 4 onglets.
// Le proxy (racine du repo) garde déjà l'authentification en amont ; cette
// garde est la défense en profondeur côté composant serveur (même patron
// que la garde is_admin() du layout admin, T6a §4.2).
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className={styles.shell}>
      <UnsavedGuardProvider>
        {/* TEMPORAIRE (24/07/2026) — aucun écran ne porte encore d'action de
            déconnexion (Profil = stub « à venir »). À retirer dès que Profil
            reprend cette action pour de bon ; suivi dans GAPS_OUVERTS.md. */}
        <form action={logout} className={styles.tempLogout}>
          <button type="submit" className={styles.tempLogoutButton}>
            Déconnexion (temporaire)
          </button>
        </form>
        <main className={styles.content}>{children}</main>
        <TabBar />
      </UnsavedGuardProvider>
    </div>
  );
}
