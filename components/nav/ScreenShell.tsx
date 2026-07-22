import { TabBar } from "./TabBar";
import { PublicNav } from "./PublicNav";
import styles from "./ScreenShell.module.css";

// Coquille des DEUX écrans partagés (Classement, Bracket) : la route étant
// UNIQUE et hors des route groups (T6a §3.2, correctif routage), c'est elle
// qui choisit sa nav — 4 onglets si connecté, nav réduite sinon — au lieu de
// la recevoir d'un layout. Composant serveur : `authenticated` est déjà
// tranché par la page appelante (une seule lecture de session par requête).
type ScreenShellProps = {
  authenticated: boolean;
  children: React.ReactNode;
};

export function ScreenShell({ authenticated, children }: ScreenShellProps) {
  if (authenticated) {
    return (
      <div className={styles.shell}>
        <main className={styles.content}>{children}</main>
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
