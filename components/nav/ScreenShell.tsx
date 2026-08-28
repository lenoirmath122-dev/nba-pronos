import { TabBar } from "./TabBar";
import { PublicNav } from "./PublicNav";
import { BugReportButton } from "@/components/feedback/BugReportButton";
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

export function ScreenShell({ authenticated, children }: ScreenShellProps) {
  if (authenticated) {
    return (
      <div className={styles.shell}>
        <main className={styles.content}>{children}</main>
        <BugReportButton />
        <TabBar />
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
