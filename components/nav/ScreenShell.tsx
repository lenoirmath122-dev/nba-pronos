import { TabBar } from "./TabBar";
import { PublicNav } from "./PublicNav";
import { GuestTabBar } from "./GuestTabBar";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { getNavBadgeData } from "@/lib/queries/home";
import styles from "./ScreenShell.module.css";

// Coquille des écrans à route physique unique, hors des route groups
// (public)/(app) (T6a §3.2, correctif routage) — Classement, Bracket,
// Règles, profil joueur public (/players/[userId]) : c'est elle qui choisit
// sa nav — 4 onglets si connecté, nav réduite sinon — au lieu de la
// recevoir d'un layout. Composant serveur : `authenticated` est déjà
// tranché par la page appelante (une seule lecture de session par requête).
type ScreenShellProps = {
  authenticated: boolean;
  /** Écran de l'appli (Classement, joueurs, bracket) : l'invité garde la barre d'onglets de /play au lieu de la nav publique. */
  guestTabs?: boolean;
  children: React.ReactNode;
};

export async function ScreenShell({ authenticated, guestTabs = false, children }: ScreenShellProps) {
  if (authenticated) {
    // Pastilles TabBar (18/09/2026) : même donnée que app/(app)/layout.tsx,
    // ici recalculée par écran plutôt que par layout puisque ces routes n'en
    // partagent aucun (voir commentaire en tête de fichier).
    const navBadges = await getNavBadgeData();
    return (
      <div className={styles.shell}>
        <main className={styles.content}>{children}</main>
        <TabBar navBadges={navBadges} />
      </div>
    );
  }

  if (guestTabs) {
    return (
      <div className={styles.shell}>
        <AuthGateProvider authenticated={false}>
          <main className={styles.content}>{children}</main>
          <GuestTabBar />
        </AuthGateProvider>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <PublicNav />
      <main className={styles.contentPublic}>{children}</main>
    </div>
  );
}
