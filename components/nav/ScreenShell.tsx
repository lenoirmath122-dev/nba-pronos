import { TabBar } from "./TabBar";
import { PublicNav } from "./PublicNav";
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
  children: React.ReactNode;
};

export async function ScreenShell({ authenticated, children }: ScreenShellProps) {
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

  return (
    <div className={styles.shell}>
      <PublicNav />
      <main className={styles.contentPublic}>{children}</main>
    </div>
  );
}
