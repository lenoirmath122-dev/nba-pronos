import { TabBar } from "./TabBar";
import { PublicNav } from "./PublicNav";
import { BugReportButton } from "@/components/feedback/BugReportButton";
import { getNavBadgeData } from "@/lib/queries/home";
import styles from "./ScreenShell.module.css";

// Coquille des écrans à route physique unique, hors des route groups
// (public)/(app) (T6a §3.2, correctif routage) — Classement, Bracket,
// Règles, profil joueur public (/players/[userId]) : c'est elle qui choisit
// sa nav — 4 onglets si connecté, nav réduite sinon — au lieu de la
// recevoir d'un layout. Composant serveur : `authenticated` est déjà
// tranché par la page appelante (une seule lecture de session par requête).
//
// BugReportButton posé ici aussi (28/08/2026, bug réel signalé par
// l'utilisateur) : app/(app)/layout.tsx ne couvre PAS ces 4 écrans,
// puisqu'ils vivent hors du groupe (app) exprès (routes physiques
// partagées visiteur/connecté) — le bouton restait invisible sur
// /leaderboard notamment. Seulement dans la branche connectée, même
// condition que TabBar : un visiteur sans session ne peut de toute façon
// pas écrire dans bug_reports (RLS, user_id = auth.uid()).
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
        <BugReportButton />
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
